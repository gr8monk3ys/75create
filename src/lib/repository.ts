// Persistence abstraction. Feature code talks ONLY to this interface — never to
// localStorage or IndexedDB directly — so the backend can later be swapped for
// Supabase by providing a new implementation. (Design spec §4.1.)

import { Artifact, Challenge, DEFAULT_BUFFER_HRS, Log, User } from './types'
import { detectTimezone } from './timezone'

export interface DayData {
  /** dayIndex -> ISO completion timestamp. */
  completions: Record<number, string>
  /** dayIndex -> log. */
  logs: Record<number, Log>
  /** `${dayIndex}:${ruleId}` -> checked. */
  checks: Record<string, boolean>
  /** dayIndex -> artifact metadata list. */
  artifacts: Record<number, Artifact[]>
  /** Day indices covered by a spent skip token. */
  skips: number[]
  /** Missed day indices whose miss-policy consequence has been applied. */
  actionedMisses: number[]
  /**
   * When each tick and completion last changed on this device (keyed
   * "k:<checkKey>" and "c:<dayIndex>"), so a merge can carry an untick or a
   * reopened day instead of resurrecting it from a stale copy.
   */
  changedAt?: Record<string, string>
  /** Artifacts removed here: a merge never brings them back. */
  removedArtifacts?: string[]
}

export function emptyDayData(): DayData {
  return { completions: {}, logs: {}, checks: {}, artifacts: {}, skips: [], actionedMisses: [] }
}

/** The storage key of one rule's tick on one day. */
export function checkKey(dayIndex: number, ruleId: string): string {
  return `${dayIndex}:${ruleId}`
}

/** The id of one day of one challenge, as logs and artifacts record it. */
export function dayId(challengeId: string, dayIndex: number): string {
  return `${challengeId}:${dayIndex}`
}

/**
 * Combine two copies of a challenge's day data (this device's and another's)
 * so that nothing either one made is lost: a completion, tick, artifact, skip
 * or actioned miss on either side survives, and each day keeps its most
 * recently written log. An undo carries too: an untick or a reopened day
 * wins when it's the later change, and a removed artifact stays removed.
 * Made work is the thing this product can't lose, so without a record of
 * who changed what last, the merge keeps it; the session reconciles misses
 * afterwards.
 */
export function mergeDayData(a: DayData, b: DayData): DayData {
  const out = emptyDayData()
  const stampA = a.changedAt ?? {}
  const stampB = b.changedAt ?? {}
  /** Which side changed `key` last: 'a', 'b', or null when neither recorded it. */
  const later = (key: string): 'a' | 'b' | null => {
    const ta = stampA[key]
    const tb = stampB[key]
    if (!ta && !tb) return null
    return (ta ?? '') >= (tb ?? '') ? 'a' : 'b'
  }

  // A completion on either side stands, unless the other side reopened
  // that day after it was made (its stamp is later).
  for (const day of new Set([...Object.keys(a.completions), ...Object.keys(b.completions)])) {
    const d = Number(day)
    const inA = a.completions[d]
    const inB = b.completions[d]
    if (inA && inB) out.completions[d] = inA < inB ? inA : inB // the earlier moment it was made
    else if (inA && later(`c:${d}`) !== 'b') out.completions[d] = inA
    else if (inB && later(`c:${d}`) !== 'a') out.completions[d] = inB
  }
  out.logs = { ...a.logs }
  for (const [day, log] of Object.entries(b.logs)) {
    const mine = a.logs[Number(day)]
    if (!mine || log.updatedAt > mine.updatedAt) out.logs[Number(day)] = log
  }
  // A tick follows whichever side changed it last; unrecorded, a tick wins.
  for (const key of new Set([...Object.keys(a.checks), ...Object.keys(b.checks)])) {
    const side = later(`k:${key}`)
    out.checks[key] =
      side === 'a' ? a.checks[key] === true
      : side === 'b' ? b.checks[key] === true
      : a.checks[key] === true || b.checks[key] === true
  }
  const removed = new Set([...(a.removedArtifacts ?? []), ...(b.removedArtifacts ?? [])])
  const days = new Set([...Object.keys(a.artifacts), ...Object.keys(b.artifacts)].map(Number))
  for (const day of days) {
    const byId = new Map<string, Artifact>()
    for (const art of [...(b.artifacts[day] ?? []), ...(a.artifacts[day] ?? [])]) {
      if (!removed.has(art.id)) byId.set(art.id, art)
    }
    out.artifacts[day] = [...byId.values()].sort((x, y) => x.createdAt.localeCompare(y.createdAt))
  }
  const changedAt: Record<string, string> = { ...stampB }
  for (const [key, at] of Object.entries(stampA)) if (!changedAt[key] || at > changedAt[key]) changedAt[key] = at
  if (Object.keys(changedAt).length > 0) out.changedAt = changedAt
  if (removed.size > 0) out.removedArtifacts = [...removed].sort()
  // A made day was never missed: a skip or actioned miss for it (from a copy
  // that rolled over before the completion arrived) doesn't survive the merge.
  const missed = (d: number) => !out.completions[d]
  out.skips = [...new Set([...a.skips, ...b.skips])].filter(missed).sort((x, y) => x - y)
  out.actionedMisses = [...new Set([...a.actionedMisses, ...b.actionedMisses])]
    .filter(missed)
    .sort((x, y) => x - y)
  return out
}

/** A fresh profile with this device's timezone and the default buffer. */
export function newUser(id: string, email: string, now: Date = new Date()): User {
  return {
    id,
    email,
    tz: detectTimezone() ?? 'UTC',
    lateNightBufferHrs: DEFAULT_BUFFER_HRS,
    createdAt: now.toISOString(),
    reminderTime: null,
  }
}

/** A consequence the person was told about, kept until they dismiss it. */
export interface PendingNotice {
  kind: 'skip' | 'extend' | 'restore'
  message: string
  days: number[]
}

export interface Repository {
  // --- user / session ---
  getUser(): User | null
  saveUser(user: User): void
  /** Whether a session is active. Signing out clears this without losing data. */
  isSignedIn(): boolean
  setSignedIn(value: boolean): void

  // --- challenges ---
  getChallenges(): Challenge[]
  saveChallenge(challenge: Challenge): void
  /** The single non-archived, non-completed challenge, if any. */
  getActiveChallenge(): Challenge | null

  // --- per-day structured data (localStorage) ---
  getDayData(challengeId: string): DayData
  saveDayCompletion(
    challengeId: string,
    dayIndex: number,
    completedAt: string | null,
  ): void
  saveLog(challengeId: string, dayIndex: number, log: Log): void
  saveCheck(
    challengeId: string,
    dayIndex: number,
    ruleId: string,
    checked: boolean,
  ): void
  saveArtifactMeta(
    challengeId: string,
    dayIndex: number,
    artifact: Artifact,
  ): void
  deleteArtifactMeta(
    challengeId: string,
    dayIndex: number,
    artifactId: string,
  ): void
  /** Record that a skip token covered this day. */
  addSkip(challengeId: string, dayIndex: number): void
  /** Record that this missed day's policy consequence has been applied. */
  addActionedMiss(challengeId: string, dayIndex: number): void
  /** Undo a miss's consequence for a day that turned out to be made. */
  clearMiss(challengeId: string, dayIndex: number): void
  /**
   * The days a sync found made that this device had actioned as missed (the
   * merge dropped their skip or miss), each returned once so the person is
   * told once. Kept on this device only, across reloads.
   */
  takeRestoredMisses(challengeId: string): number[]
  /**
   * The notice waiting to be dismissed: it's the only place a person learns a
   * token was spent while they were away, so it outlasts a reload. Per
   * account, on this device only (never pushed).
   */
  pendingNotice(): PendingNotice | null
  setPendingNotice(notice: PendingNotice | null): void

  // --- artifact blobs (IndexedDB) ---
  saveArtifactBlob(blob: Blob): Promise<string>
  getArtifactBlob(id: string): Promise<Blob | null>
  deleteArtifactBlob(id: string): Promise<void>

  // --- account ---
  deleteAllData(): Promise<void>
}

/** Generate a unique id. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}
