// Pure challenge logic: day-index math, day states, streaks, miss policies.
// No I/O and no implicit clock — the current time is always passed in, so
// every function is deterministic and unit-testable. (Design spec §4.2.)

import {
  Challenge,
  Day,
  DayState,
  TOTAL_DAYS,
  MAX_SKIP_TOKENS,
} from './types'
import { creativeDate, daysBetween } from './creativeDay'

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
  if (delta < 0) return 0
  return delta + 1
}

/** Total number of days in the challenge grid (base 75 plus any extensions). */
function totalDays(challenge: Challenge): number {
  return TOTAL_DAYS + (challenge.extraDays ?? 0)
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
  const total = totalDays(challenge)
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
 * day) and the longest completed run anywhere in the challenge.
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
    } else {
      run = 0
    }
  }

  // Current streak: count backwards from currentIndex over completed days.
  // If today isn't complete yet, start from the day before.
  let current = 0
  const byIndex = new Map(days.map((d) => [d.index, d]))
  let i = currentIndex
  if (byIndex.get(i)?.state !== 'complete') i -= 1
  while (i >= 1 && byIndex.get(i)?.state === 'complete') {
    current++
    i--
  }

  return { current, longest }
}

export interface MissOutcome {
  action: 'reset' | 'skip' | 'extend'
  message: string
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
  switch (challenge.missPolicy) {
    case 'classic':
      return {
        ...base,
        action: 'reset',
        message: 'A day was missed. Classic mode restarts you at Day 1.',
      }
    case 'grace': {
      if (challenge.skipTokensUsed >= MAX_SKIP_TOKENS) {
        return {
          ...base,
          action: 'reset',
          message:
            'A day was missed and your 3 skip tokens are spent. Restarting at Day 1.',
        }
      }
      const used = challenge.skipTokensUsed + 1
      return {
        ...base,
        action: 'skip',
        newSkipTokensUsed: used,
        message: `A day was missed. You used skip token ${used} of ${MAX_SKIP_TOKENS}.`,
      }
    }
    case 'extend': {
      const extra = (challenge.extraDays ?? 0) + 1
      return {
        ...base,
        action: 'extend',
        extraDays: extra,
        message:
          'A day was missed. Extend mode adds a day to the end — your streak display resets but the challenge continues.',
      }
    }
  }
}
