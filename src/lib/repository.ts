// Persistence abstraction. Feature code talks ONLY to this interface — never to
// localStorage or IndexedDB directly — so the backend can later be swapped for
// Supabase by providing a new implementation. (Design spec §4.1.)

import { Artifact, Challenge, Log, User } from './types'

export interface DayData {
  /** dayIndex -> ISO completion timestamp. */
  completions: Record<number, string>
  /** dayIndex -> log. */
  logs: Record<number, Log>
  /** `${dayIndex}:${ruleId}` -> checked. */
  checks: Record<string, boolean>
  /** dayIndex -> artifact metadata list. */
  artifacts: Record<number, Artifact[]>
}

export function emptyDayData(): DayData {
  return { completions: {}, logs: {}, checks: {}, artifacts: {} }
}

export interface Repository {
  // --- user ---
  getUser(): User | null
  saveUser(user: User): void

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
