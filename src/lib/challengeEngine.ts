// Pure challenge logic: day-index math, day states, streaks, miss policies.
// No I/O and no implicit clock — the current time is always passed in, so
// every function is deterministic and unit-testable. (Design spec §4.2.)

import { Challenge, Day, DayState } from './types'
import { creativeDate, daysBetween } from './creativeDay'
import { lengthWith, missesEndAttempt } from './missPolicy'

/**
 * The current 1-based day index of a challenge.
 * Returns 0 before the start date, 1..N during, and N+1 (past the end) after.
 * The late-night buffer shifts the effective clock back so that e.g. 2am still
 * counts as the previous creative day.
 */
export function currentDayIndex(
  challenge: Challenge,
  now: Date,
  tz: string,
  bufferHrs: number,
): number {
  const delta = daysBetween(challenge.startDate, creativeDate(now, tz, bufferHrs))
  // A corrupt start date reads as not started, never as "Day NaN".
  if (!Number.isFinite(delta) || delta < 0) return 0
  return delta + 1
}

/** Total number of days in the challenge grid (base 75 plus any extensions). */
export function challengeLength(challenge: Challenge): number {
  return lengthWith(challenge.missPolicy, challenge.extraDays ?? 0)
}

/**
 * The state of every day in the challenge, given a map of completed day index
 * to completion timestamp.
 */
export function computeDayStates(
  challenge: Challenge,
  completions: Record<number, string>,
  now: Date,
  tz: string,
  bufferHrs: number,
  skips: number[] = [],
): Day[] {
  const current = currentDayIndex(challenge, now, tz, bufferHrs)
  const total = challengeLength(challenge)
  const skipped = new Set(skips)
  const days: Day[] = []
  for (let index = 1; index <= total; index++) {
    const completedAt = completions[index] ?? null
    let state: DayState
    if (completedAt) state = 'complete'
    else if (skipped.has(index)) state = 'skipped'
    else if (index === current) state = 'today'
    else if (current > 0 && index < current) state = 'missed'
    else state = 'future'
    days.push({ challengeId: challenge.id, index, state, completedAt })
  }
  return days
}

/**
 * Current streak (run of completed days ending at, or just before, the current
 * day) and the longest completed run anywhere in the challenge. A skipped day
 * (covered by a skip token) neither adds to a run nor breaks it: spending a
 * token is what protects the streak.
 */
export function streaks(
  days: Day[],
  currentIndex: number,
): { current: number; longest: number } {
  let longest = 0
  let run = 0
  for (const day of days) {
    if (day.state === 'complete') {
      run++
      if (run > longest) longest = run
    } else if (day.state !== 'skipped') {
      run = 0
    }
  }

  // Current streak: count backwards from currentIndex over completed days.
  // If today isn't complete yet, start from the day before.
  let current = 0
  const byIndex = new Map(days.map((d) => [d.index, d]))
  let i = currentIndex
  if (byIndex.get(i)?.state !== 'complete') i -= 1
  for (; i >= 1; i--) {
    const state = byIndex.get(i)?.state
    if (state === 'complete') current++
    else if (state !== 'skipped') break
  }

  return { current, longest }
}

export interface MissOutcome {
  action: 'reset' | 'skip' | 'extend'
  newSkipTokensUsed: number
  extraDays: number
}

/**
 * The consequence of one missed day under the challenge's miss policy. Pure:
 * the caller decides which days are missed and persists the result.
 */
export function missConsequence(challenge: Challenge): MissOutcome {
  const base = {
    newSkipTokensUsed: challenge.skipTokensUsed,
    extraDays: challenge.extraDays ?? 0,
  }
  if (missesEndAttempt(challenge.missPolicy, challenge.skipTokensUsed, 1)) {
    return { ...base, action: 'reset' }
  }
  switch (challenge.missPolicy) {
    case 'classic': // Every Classic miss ends the attempt (handled above).
      return { ...base, action: 'reset' }
    case 'grace':
      return { ...base, action: 'skip', newSkipTokensUsed: challenge.skipTokensUsed + 1 }
    case 'extend':
      return { ...base, action: 'extend', extraDays: base.extraDays + 1 }
  }
}
