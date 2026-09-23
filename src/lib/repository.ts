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
 * recently written log. Made work is the thing this product can't lose, so
 * the merge errs toward keeping it; the session reconciles misses afterwards.
 */
export function mergeDayData(a: DayData, b: DayData): DayData {
  const out = emptyDayData()
  out.completions = { ...b.completions, ...a.completions }
  for (const [day, at] of Object.entries(b.completions)) {
    const mine = a.completions[Number(day)]
    // Keep the earlier moment the day was made.
    if (mine && at < mine) out.completions[Number(day)] = at
  }
  out.logs = { ...a.logs }
  for (const [day, log] of Object.entries(b.logs)) {
    const mine = a.logs[Number(day)]
    if (!mine || log.updatedAt > mine.updatedAt) out.logs[Number(day)] = log
  }
  out.checks = { ...b.checks }
  for (const [key, on] of Object.entries(a.checks)) out.checks[key] = on || b.checks[key] === true
  const days = new Set([...Object.keys(a.artifacts), ...Object.keys(b.artifacts)].map(Number))
  for (const day of days) {
    const byId = new Map<string, Artifact>()
    for (const art of [...(b.artifacts[day] ?? []), ...(a.artifacts[day] ?? [])]) byId.set(art.id, art)
    out.artifacts[day] = [...byId.values()].sort((x, y) => x.createdAt.localeCompare(y.createdAt))
  }
  out.skips = [...new Set([...a.skips, ...b.skips])].sort((x, y) => x - y)
  out.actionedMisses = [...new Set([...a.actionedMisses, ...b.actionedMisses])].sort((x, y) => x - y)
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
