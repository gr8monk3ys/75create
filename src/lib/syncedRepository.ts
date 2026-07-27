// Local-first sync: wraps LocalRepository so every read/write stays local and
// synchronous (the app keeps working offline), while mutations are mirrored to
// Supabase through a persistent outbox. Conflict policy is last-write-wins per
// row (profile / challenge / day-data blob), which matches a single person
// tracking one challenge across devices.

import type { SupabaseClient } from '@supabase/supabase-js'
import { DayData, Repository } from './repository'
import { LocalRepository } from './localRepository'
import { Artifact, Challenge, Log, User } from './types'
import { ARTIFACTS_BUCKET } from './supabase'

const OUTBOX_KEY = '75create.outbox.v1'
const STAMPS_KEY = '75create.stamps.v1'
const FLUSH_DELAY_MS = 1500

interface Outbox {
  profile: boolean
  challenges: string[]
  dayData: string[]
  uploadBlobs: string[]
  deleteBlobs: string[]
}

function emptyOutbox(): Outbox {
  return { profile: false, challenges: [], dayData: [], uploadBlobs: [], deleteBlobs: [] }
}

/** Local updated_at stamps per synced row, for last-write-wins hydration. */
interface Stamps {
  profile?: string
  challenges: Record<string, string>
  dayData: Record<string, string>
}

function emptyStamps(): Stamps {
  return { challenges: {}, dayData: {} }
}

export class SyncedRepository implements Repository {
  private local: LocalRepository
  private client: SupabaseClient
  private userId: string | null = null
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private flushing = false

  constructor(local: LocalRepository, client: SupabaseClient) {
    this.local = local
    this.client = client
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.flush())
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') void this.flush()
      })
    }
  }

  // ---- outbox / stamps persistence ----
  private readJson<T>(key: string, fallback: T): T {
    if (typeof localStorage === 'undefined') return fallback
    try {
      const raw = localStorage.getItem(key)
      return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback
    } catch {
      return fallback
    }
  }

  private writeJson(key: string, value: unknown): void {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, JSON.stringify(value))
  }

  private markDirty(patch: (o: Outbox) => void): void {
    const outbox = this.readJson(OUTBOX_KEY, emptyOutbox())
    patch(outbox)
    this.writeJson(OUTBOX_KEY, outbox)
    this.stamp()
    this.scheduleFlush()
  }

  private stamp(): void {
    // Record local modification time for LWW comparisons during hydration.
    const stamps = this.readJson(STAMPS_KEY, emptyStamps())
    const now = new Date().toISOString()
    const outbox = this.readJson(OUTBOX_KEY, emptyOutbox())
    if (outbox.profile) stamps.profile = now
    for (const id of outbox.challenges) stamps.challenges[id] = now
    for (const id of outbox.dayData) stamps.dayData[id] = now
    this.writeJson(STAMPS_KEY, stamps)
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => void this.flush(), FLUSH_DELAY_MS)
  }

  /** Attach the signed-in Supabase user and pull remote state into the local store. */
  async connectRemote(userId: string, email: string): Promise<void> {
    this.userId = userId
    await this.ensureProfile(userId, email)
    await this.hydrate(userId)
    await this.flush()
  }

  disconnectRemote(): void {
    this.userId = null
  }

  private async ensureProfile(userId: string, email: string): Promise<void> {
    const existing = await this.client
      .from('profiles')
      .select('id, email, tz, late_night_buffer_hrs, reminder_time, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle()

    const localUser = this.local.getUser()
    if (!existing.data) {
      const user: User = localUser ?? {
        id: userId,
        email,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        lateNightBufferHrs: 3,
        createdAt: new Date().toISOString(),
        reminderTime: null,
      }
      const synced: User = { ...user, id: userId, email }
      this.local.saveUser(synced)
      await this.client.from('profiles').upsert({
        id: userId,
        email,
        tz: synced.tz,
        late_night_buffer_hrs: synced.lateNightBufferHrs,
        reminder_time: synced.reminderTime,
        updated_at: new Date().toISOString(),
      })
    } else {
      const row = existing.data
      this.local.saveUser({
        id: userId,
        email: row.email,
        tz: row.tz,
        lateNightBufferHrs: row.late_night_buffer_hrs,
        createdAt: row.created_at,
        reminderTime: row.reminder_time,
      })
    }
  }

  /** Pull remote rows newer than the local stamps into the local store. */
  private async hydrate(userId: string): Promise<void> {
    const stamps = this.readJson(STAMPS_KEY, emptyStamps())

    const challenges = await this.client
      .from('challenges')
      .select('id, data, updated_at')
      .eq('user_id', userId)
    for (const row of challenges.data ?? []) {
      const localStamp = stamps.challenges[row.id]
      if (!localStamp || row.updated_at > localStamp) {
        this.local.saveChallenge(row.data as Challenge)
        stamps.challenges[row.id] = row.updated_at
      }
    }

    const dayData = await this.client
      .from('day_data')
      .select('challenge_id, data, updated_at')
      .eq('user_id', userId)
    for (const row of dayData.data ?? []) {
      const localStamp = stamps.dayData[row.challenge_id]
      if (!localStamp || row.updated_at > localStamp) {
        this.local.replaceDayData(row.challenge_id, row.data as DayData)
        stamps.dayData[row.challenge_id] = row.updated_at
      }
    }

    this.writeJson(STAMPS_KEY, stamps)
  }

  /** Push everything in the outbox to Supabase. Safe to call repeatedly. */
  async flush(): Promise<void> {
    if (!this.userId || this.flushing) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    const outbox = this.readJson(OUTBOX_KEY, emptyOutbox())
    const hasWork =
      outbox.profile ||
      outbox.challenges.length > 0 ||
      outbox.dayData.length > 0 ||
      outbox.uploadBlobs.length > 0 ||
      outbox.deleteBlobs.length > 0
    if (!hasWork) return

    this.flushing = true
    const now = new Date().toISOString()
    const done: Partial<Record<keyof Outbox, Set<string> | boolean>> = {}
    try {
      if (outbox.profile) {
        const user = this.local.getUser()
        if (user) {
          const res = await this.client.from('profiles').upsert({
            id: this.userId,
            email: user.email,
            tz: user.tz,
            late_night_buffer_hrs: user.lateNightBufferHrs,
            reminder_time: user.reminderTime,
            updated_at: now,
          })
          if (!res.error) done.profile = true
        } else {
          done.profile = true
        }
      }

      const challengeById = new Map(this.local.getChallenges().map((c) => [c.id, c]))
      const syncedChallenges = new Set<string>()
      for (const id of outbox.challenges) {
        const challenge = challengeById.get(id)
        if (!challenge) {
          syncedChallenges.add(id)
          continue
        }
        const res = await this.client.from('challenges').upsert({
          id,
          user_id: this.userId,
          data: challenge,
          updated_at: now,
        })
        if (!res.error) syncedChallenges.add(id)
      }
      done.challenges = syncedChallenges

      const syncedDayData = new Set<string>()
      for (const id of outbox.dayData) {
        // Day data references its challenge row; make sure it exists remotely
        // even if the challenge itself wasn't dirty this round.
        const challenge = challengeById.get(id)
        if (challenge && !syncedChallenges.has(id)) {
          await this.client
            .from('challenges')
            .upsert({ id, user_id: this.userId, data: challenge, updated_at: now })
        }
        const res = await this.client.from('day_data').upsert({
          challenge_id: id,
          user_id: this.userId,
          data: this.local.getDayData(id),
          updated_at: now,
        })
        if (!res.error) syncedDayData.add(id)
      }
      done.dayData = syncedDayData

      const uploaded = new Set<string>()
      for (const blobRef of outbox.uploadBlobs) {
        const blob = await this.local.getArtifactBlob(blobRef)
        if (!blob) {
          uploaded.add(blobRef)
          continue
        }
        const res = await this.client.storage
          .from(ARTIFACTS_BUCKET)
          .upload(`${this.userId}/${blobRef}`, blob, { upsert: true })
        if (!res.error) uploaded.add(blobRef)
      }
      done.uploadBlobs = uploaded

      const removed = new Set<string>()
      for (const blobRef of outbox.deleteBlobs) {
        const res = await this.client.storage
          .from(ARTIFACTS_BUCKET)
          .remove([`${this.userId}/${blobRef}`])
        if (!res.error) removed.add(blobRef)
      }
      done.deleteBlobs = removed
    } finally {
      // Drop only what succeeded; anything else is retried on the next flush.
      const fresh = this.readJson(OUTBOX_KEY, emptyOutbox())
      if (done.profile) fresh.profile = false
      const keep = (list: string[], ok?: Set<string> | boolean) =>
        list.filter((id) => !(ok instanceof Set && ok.has(id)))
      fresh.challenges = keep(fresh.challenges, done.challenges)
      fresh.dayData = keep(fresh.dayData, done.dayData)
      fresh.uploadBlobs = keep(fresh.uploadBlobs, done.uploadBlobs)
      fresh.deleteBlobs = keep(fresh.deleteBlobs, done.deleteBlobs)
      this.writeJson(OUTBOX_KEY, fresh)
      this.flushing = false
    }
  }

  // ---- Repository: user / session ----
  getUser(): User | null {
    return this.local.getUser()
  }

  saveUser(user: User): void {
    this.local.saveUser(user)
    this.markDirty((o) => {
      o.profile = true
    })
  }

  isSignedIn(): boolean {
    return this.local.isSignedIn()
  }

  setSignedIn(value: boolean): void {
    this.local.setSignedIn(value)
  }

  // ---- Repository: challenges ----
  getChallenges(): Challenge[] {
    return this.local.getChallenges()
  }

  saveChallenge(challenge: Challenge): void {
    this.local.saveChallenge(challenge)
    this.markDirty((o) => {
      if (!o.challenges.includes(challenge.id)) o.challenges.push(challenge.id)
    })
  }

  getActiveChallenge(): Challenge | null {
    return this.local.getActiveChallenge()
  }

  // ---- Repository: day data ----
  getDayData(challengeId: string): DayData {
    return this.local.getDayData(challengeId)
  }

  private dirtyDay(challengeId: string): void {
    this.markDirty((o) => {
      if (!o.dayData.includes(challengeId)) o.dayData.push(challengeId)
    })
  }

  saveDayCompletion(challengeId: string, dayIndex: number, completedAt: string | null): void {
    this.local.saveDayCompletion(challengeId, dayIndex, completedAt)
    this.dirtyDay(challengeId)
  }

  saveLog(challengeId: string, dayIndex: number, log: Log): void {
    this.local.saveLog(challengeId, dayIndex, log)
    this.dirtyDay(challengeId)
  }

  saveCheck(challengeId: string, dayIndex: number, ruleId: string, checked: boolean): void {
    this.local.saveCheck(challengeId, dayIndex, ruleId, checked)
    this.dirtyDay(challengeId)
  }

  saveArtifactMeta(challengeId: string, dayIndex: number, artifact: Artifact): void {
    this.local.saveArtifactMeta(challengeId, dayIndex, artifact)
    this.dirtyDay(challengeId)
  }

  deleteArtifactMeta(challengeId: string, dayIndex: number, artifactId: string): void {
    this.local.deleteArtifactMeta(challengeId, dayIndex, artifactId)
    this.dirtyDay(challengeId)
  }

  addSkip(challengeId: string, dayIndex: number): void {
    this.local.addSkip(challengeId, dayIndex)
    this.dirtyDay(challengeId)
  }

  addActionedMiss(challengeId: string, dayIndex: number): void {
    this.local.addActionedMiss(challengeId, dayIndex)
    this.dirtyDay(challengeId)
  }

  // ---- Repository: artifact blobs ----
  async saveArtifactBlob(blob: Blob): Promise<string> {
    const id = await this.local.saveArtifactBlob(blob)
    this.markDirty((o) => {
      if (!o.uploadBlobs.includes(id)) o.uploadBlobs.push(id)
    })
    return id
  }

  async getArtifactBlob(id: string): Promise<Blob | null> {
    const cached = await this.local.getArtifactBlob(id)
    if (cached) return cached
    // Captured on another device: fetch from Storage and cache locally.
    if (!this.userId) return null
    const res = await this.client.storage
      .from(ARTIFACTS_BUCKET)
      .download(`${this.userId}/${id}`)
    if (res.error || !res.data) return null
    await this.local.putArtifactBlob(id, res.data)
    return res.data
  }

  async deleteArtifactBlob(id: string): Promise<void> {
    await this.local.deleteArtifactBlob(id)
    this.markDirty((o) => {
      o.uploadBlobs = o.uploadBlobs.filter((b) => b !== id)
      if (!o.deleteBlobs.includes(id)) o.deleteBlobs.push(id)
    })
  }

  // ---- Repository: account ----
  async deleteAllData(): Promise<void> {
    if (this.userId) {
      // Best effort remote wipe first; local wipe always happens.
      const files = await this.client.storage.from(ARTIFACTS_BUCKET).list(this.userId)
      const names = (files.data ?? []).map((f) => `${this.userId}/${f.name}`)
      if (names.length > 0) await this.client.storage.from(ARTIFACTS_BUCKET).remove(names)
      await this.client.from('day_data').delete().eq('user_id', this.userId)
      await this.client.from('challenges').delete().eq('user_id', this.userId)
      await this.client.from('profiles').delete().eq('id', this.userId)
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(OUTBOX_KEY)
      localStorage.removeItem(STAMPS_KEY)
    }
    await this.local.deleteAllData()
  }
}
