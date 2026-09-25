// Scheduling helpers shared by the reminder senders (email and push). Plain
// TypeScript with no Deno APIs, so bun tests import it directly.

import { creativeDate, daysBetween, localTime } from './creativeDay.ts'
import { MissPolicy, lengthWith, missesEndAttempt } from './missPolicy.ts'

function localMinutes(tz: string, now: Date): number {
  const [h, m] = localTime(now, tz).split(':').map(Number)
  return h * 60 + m
}

/**
 * Whether a daily "HH:MM" reminder in `tz` fell within the last `windowMin`
 * minutes. The window wraps midnight, so a 23:55 reminder is still due when a
 * quarter-hourly run lands at 00:05. An invalid zone falls back to UTC rather
 * than throwing and aborting the whole batch.
 */
export function reminderDue(
  reminderTime: string | null,
  tz: string | null,
  now: Date,
  windowMin: number,
): boolean {
  const [h, m] = String(reminderTime).split(':').map(Number)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return false
  let local: number
  try {
    local = localMinutes(tz || 'UTC', now)
  } catch {
    local = localMinutes('UTC', now)
  }
  const delta = (((local - (h * 60 + m)) % 1440) + 1440) % 1440
  return delta < windowMin
}

/** Constant-time-ish comparison, so a secret can't be probed byte by byte. */
export function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided || provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

// ---------- is today still to make? ----------
//
// The same rules as the app, from the same shared modules (creativeDay,
// missPolicy): a challenge that's ended (an unactioned Classic miss, or Grace
// with no token left for one) no longer gets nudged, even before the app has
// rolled over.


/** The stored shape the senders read (a subset of the app's Challenge). */
export interface StoredChallenge {
  id: string
  status: string
  startDate: string
  missPolicy?: MissPolicy
  skipTokensUsed?: number
  extraDays?: number
}

/** The stored shape of a challenge's day data (a subset of the app's DayData). */
export interface StoredDayData {
  completions?: Record<string, string>
  skips?: number[]
  actionedMisses?: number[]
}

/**
 * Whether a reminder has anything to remind about: a running challenge whose
 * creative day today has started, isn't past the last day, and isn't made
 * yet. No challenge, a future start, an attempt already ended by a miss, a
 * finished round or maintenance, or a day already made: no nudge.
 */
export function todayNeedsMaking(
  challenges: StoredChallenge[],
  dayData: Record<string, StoredDayData | undefined>,
  tz: string | null,
  bufferHrs: number | null,
  now: Date,
): boolean {
  const active = challenges.find((c) => c.status === 'active')
  if (!active) return false
  let today: string
  try {
    today = creativeDate(now, tz || 'UTC', bufferHrs ?? 3)
  } catch {
    today = creativeDate(now, 'UTC', bufferHrs ?? 3)
  }
  const index = daysBetween(active.startDate, today) + 1
  if (!Number.isFinite(index) || index < 1) return false

  const dd = dayData[active.id] ?? {}
  const settled = (d: number) =>
    Boolean(dd.completions?.[String(d)]) || (dd.skips ?? []).includes(d) || (dd.actionedMisses ?? []).includes(d)
  let pending = 0
  for (let d = 1; d < index; d++) if (!settled(d)) pending++
  // Misses the app hasn't rolled over yet: under Classic, or Grace without
  // enough tokens, the attempt has already ended.
  const policy = active.missPolicy ?? 'classic'
  if (missesEndAttempt(policy, active.skipTokensUsed ?? 0, pending)) return false
  // Under Extend, each pending miss will add a day to the end.
  const length = lengthWith(policy, active.extraDays ?? 0, pending)
  if (index > length) return false
  return !dd.completions?.[String(index)]
}
