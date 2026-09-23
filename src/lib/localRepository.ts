// localStorage (structured data) + IndexedDB (artifact blobs) implementation
// of the Repository interface.

import {
  DayData,
  checkKey,
  PendingNotice,
  Repository,
  emptyDayData,
  newId,
} from './repository'
import { Artifact, Challenge, Log, User } from './types'

const KEY_PREFIX = '75create.'
const ROOT_KEY = `${KEY_PREFIX}v1`
/** Where an unreadable root is kept, untouched, before a fresh one replaces it. */
export const UNREADABLE_KEY = `${KEY_PREFIX}v1.unreadable`
/**
 * Accounts other than the current one keep their data under
 * `75create.park.<userId>` (and whatever else a caller parks under
 * `75create.park.<userId>.<name>`), so a device shared between accounts never
 * mixes their challenges and switching back restores everything.
 */
export const PARK_PREFIX = `${KEY_PREFIX}park.`
const DB_NAME = '75create'
const DB_STORE = 'artifacts'

interface Root {
  user: User | null
  challenges: Challenge[]
  dayData: Record<string, DayData>
  signedIn: boolean
  /** Per challenge, restored misses not yet told (see takeRestoredMisses). */
  restored?: Record<string, number[]>
  /** The notice waiting to be dismissed (see pendingNotice). */
  notice?: PendingNotice | null
}

/** Record when a tick or completion changed, for merges (see mergeDayData). */
function stamp(dd: DayData, key: string): void {
  dd.changedAt = { ...dd.changedAt, [key]: new Date().toISOString() }
}

function emptyRoot(): Root {
  return { user: null, challenges: [], dayData: {}, signedIn: false }
}

export class LocalRepository implements Repository {
  // ---- root read/write ----
  private read(): Root {
    if (typeof localStorage === 'undefined') return emptyRoot()
    const raw = localStorage.getItem(ROOT_KEY)
    if (!raw) return emptyRoot()
    try {
      const parsed = JSON.parse(raw) as Root
      return { ...emptyRoot(), ...parsed }
    } catch {
      // Unreadable (a partial write, a bad extension): keep the raw text
      // before anything writes over it, so the challenge can be recovered.
      try {
        if (localStorage.getItem(UNREADABLE_KEY) === null) localStorage.setItem(UNREADABLE_KEY, raw)
      } catch {
        /* storage full: nothing more to be done here */
      }
      return emptyRoot()
    }
  }

  private write(root: Root): void {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(ROOT_KEY, JSON.stringify(root))
  }

  private dayDataFor(root: Root, challengeId: string): DayData {
    // Normalize in place so mutations by the caller persist on write, while
    // backfilling any fields missing from older stored data.
    root.dayData[challengeId] = { ...emptyDayData(), ...root.dayData[challengeId] }
    return root.dayData[challengeId]
  }

  // ---- user ----
  getUser(): User | null {
    return this.read().user
  }

  saveUser(user: User): void {
    const root = this.read()
    root.user = user
    this.write(root)
  }

  isSignedIn(): boolean {
    return this.read().signedIn && this.read().user !== null
  }

  setSignedIn(value: boolean): void {
    // Signing out runs right after account deletion. Writing an empty root here
    // would resurrect the storage key seconds after the user asked for every
    // trace of it to be gone, so there is nothing to do when it is already gone.
    if (
      !value &&
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(ROOT_KEY) === null
    ) {
      return
    }
    const root = this.read()
    root.signedIn = value
    this.write(root)
  }

  // ---- accounts on this device ----
  /** Accounts whose data is parked on this device (not the current one). */
  parkedUsers(): User[] {
    if (typeof localStorage === 'undefined') return []
    const users: User[] = []
    for (const key of Object.keys(localStorage)) {
      const id = key.startsWith(PARK_PREFIX) ? key.slice(PARK_PREFIX.length) : ''
      if (!id || id.includes('.')) continue
      try {
        const parked = JSON.parse(localStorage.getItem(key) ?? '') as Root
        if (parked.user) users.push(parked.user)
      } catch {
        /* unreadable park: skip it rather than fail sign-in */
      }
    }
    return users
  }

  /**
   * Make `user` this device's current account. The current account's data is
   * parked, never merged into the new one or discarded; a parked account comes
   * back exactly as it was left. Signed out afterwards: signing in is the
   * caller's next step.
   */
  switchUser(user: User): void {
    if (typeof localStorage === 'undefined') return
    const root = this.read()
    if (root.user?.id === user.id) return
    if (root.user) {
      localStorage.setItem(PARK_PREFIX + root.user.id, JSON.stringify({ ...root, signedIn: false }))
    }
    const parkedKey = PARK_PREFIX + user.id
    const raw = localStorage.getItem(parkedKey)
    let next: Root = { ...emptyRoot(), user }
    if (raw) {
      try {
        next = { ...emptyRoot(), ...(JSON.parse(raw) as Root), signedIn: false }
      } catch {
        /* corrupt park: start the account fresh */
      }
    }
    localStorage.removeItem(parkedKey)
    this.write(next)
  }

  // ---- challenges ----
  getChallenges(): Challenge[] {
    return this.read().challenges
  }

  saveChallenge(challenge: Challenge): void {
    const root = this.read()
    const i = root.challenges.findIndex((c) => c.id === challenge.id)
    if (i >= 0) root.challenges[i] = challenge
    else root.challenges.push(challenge)
    this.write(root)
  }

  getActiveChallenge(): Challenge | null {
    return (
      this.read().challenges.find(
        (c) => c.status === 'active' || c.status === 'maintenance',
      ) ?? null
    )
  }

  // ---- day data ----
  getDayData(challengeId: string): DayData {
    return { ...emptyDayData(), ...this.read().dayData[challengeId] }
  }

  saveDayCompletion(
    challengeId: string,
    dayIndex: number,
    completedAt: string | null,
  ): void {
    const root = this.read()
    const dd = this.dayDataFor(root, challengeId)
    if (completedAt === null) delete dd.completions[dayIndex]
    else dd.completions[dayIndex] = completedAt
    stamp(dd, `c:${dayIndex}`)
    this.write(root)
  }

  saveLog(challengeId: string, dayIndex: number, log: Log): void {
    const root = this.read()
    const dd = this.dayDataFor(root, challengeId)
    dd.logs[dayIndex] = log
    this.write(root)
  }

  saveCheck(
    challengeId: string,
    dayIndex: number,
    ruleId: string,
    checked: boolean,
  ): void {
    const root = this.read()
    const dd = this.dayDataFor(root, challengeId)
    dd.checks[checkKey(dayIndex, ruleId)] = checked
    stamp(dd, `k:${checkKey(dayIndex, ruleId)}`)
    this.write(root)
  }

  saveArtifactMeta(
    challengeId: string,
    dayIndex: number,
    artifact: Artifact,
  ): void {
    const root = this.read()
    const dd = this.dayDataFor(root, challengeId)
    if (!dd.artifacts[dayIndex]) dd.artifacts[dayIndex] = []
    dd.artifacts[dayIndex].push(artifact)
    this.write(root)
  }

  deleteArtifactMeta(
    challengeId: string,
    dayIndex: number,
    artifactId: string,
  ): void {
    const root = this.read()
    const dd = this.dayDataFor(root, challengeId)
    dd.artifacts[dayIndex] = (dd.artifacts[dayIndex] ?? []).filter(
      (a) => a.id !== artifactId,
    )
    // Remembered, so a merge with a copy that still has it can't bring it back.
    dd.removedArtifacts = [...new Set([...(dd.removedArtifacts ?? []), artifactId])]
    this.write(root)
  }

  addSkip(challengeId: string, dayIndex: number): void {
    const root = this.read()
    const dd = this.dayDataFor(root, challengeId)
    if (!dd.skips.includes(dayIndex)) dd.skips.push(dayIndex)
    this.write(root)
  }

  addActionedMiss(challengeId: string, dayIndex: number): void {
    const root = this.read()
    const dd = this.dayDataFor(root, challengeId)
    if (!dd.actionedMisses.includes(dayIndex)) dd.actionedMisses.push(dayIndex)
    this.write(root)
  }

  clearMiss(challengeId: string, dayIndex: number): void {
    const root = this.read()
    const dd = this.dayDataFor(root, challengeId)
    dd.skips = dd.skips.filter((d) => d !== dayIndex)
    dd.actionedMisses = dd.actionedMisses.filter((d) => d !== dayIndex)
    this.write(root)
  }

  /**
   * Overwrite a challenge's entire day-data blob with a merged copy (sync).
   * A miss this device had actioned that the new copy shows made is kept as
   * restored, for the session to tell (takeRestoredMisses): this is the one
   * place that still knows what the merge dropped.
   */
  replaceDayData(challengeId: string, data: DayData): void {
    const root = this.read()
    const before = this.dayDataFor(root, challengeId)
    const next = { ...emptyDayData(), ...data }
    const still = new Set([...next.skips, ...next.actionedMisses])
    const restored = [...new Set([...before.skips, ...before.actionedMisses])].filter(
      (d) => next.completions[d] && !still.has(d),
    )
    if (restored.length > 0) {
      const told = root.restored?.[challengeId] ?? []
      root.restored = {
        ...root.restored,
        [challengeId]: [...new Set([...told, ...restored])].sort((a, b) => a - b),
      }
    }
    root.dayData[challengeId] = next
    this.write(root)
  }

  pendingNotice(): PendingNotice | null {
    return this.read().notice ?? null
  }

  setPendingNotice(notice: PendingNotice | null): void {
    const root = this.read()
    root.notice = notice
    this.write(root)
  }

  takeRestoredMisses(challengeId: string): number[] {
    const root = this.read()
    const days = root.restored?.[challengeId] ?? []
    if (days.length === 0) return []
    delete root.restored![challengeId]
    this.write(root)
    return days
  }

  // ---- IndexedDB blobs ----
  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async saveArtifactBlob(blob: Blob): Promise<string> {
    const id = newId()
    await this.putArtifactBlob(id, blob)
    return id
  }

  /** Store a blob under a caller-chosen id (used by remote hydration). */
  async putArtifactBlob(id: string, blob: Blob): Promise<void> {
    // Store the raw bytes + type rather than the Blob itself: ArrayBuffers
    // survive structured clone identically across browsers and test shims.
    const buffer = await blob.arrayBuffer()
    const db = await this.openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite')
      tx.objectStore(DB_STORE).put({ buffer, type: blob.type }, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }

  async getArtifactBlob(id: string): Promise<Blob | null> {
    const db = await this.openDb()
    const record = await new Promise<{ buffer: ArrayBuffer; type: string } | null>(
      (resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readonly')
        const req = tx.objectStore(DB_STORE).get(id)
        req.onsuccess = () => resolve(req.result ?? null)
        req.onerror = () => reject(req.error)
      },
    )
    db.close()
    if (!record) return null
    return new Blob([record.buffer], { type: record.type })
  }

  async deleteArtifactBlob(id: string): Promise<void> {
    const db = await this.openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite')
      tx.objectStore(DB_STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }

  // ---- account ----
  /**
   * Delete the current account's data. Other accounts parked on this device
   * are left alone, down to their artifact images.
   */
  async deleteAllData(): Promise<void> {
    const root = this.read()
    const othersParked = this.parkedUsers().length > 0
    if (typeof localStorage !== 'undefined') {
      // Every key the app writes shares the prefix (root data, sync outbox,
      // reminder bookkeeping): deletion leaves none of them behind.
      const ours = Object.keys(localStorage).filter(
        (k) => k.startsWith(KEY_PREFIX) && !k.startsWith(PARK_PREFIX),
      )
      for (const k of ours) localStorage.removeItem(k)
    }
    const db = await this.openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite')
      if (!othersParked) {
        tx.objectStore(DB_STORE).clear()
      } else {
        for (const dd of Object.values(root.dayData)) {
          for (const list of Object.values(dd.artifacts ?? {})) {
            for (const a of list) if (a.blobRef) tx.objectStore(DB_STORE).delete(a.blobRef)
          }
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }
}
