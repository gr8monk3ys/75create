// Human wording for the values the domain stores as data: calendar dates,
// "HH:MM" times, policy ids. Dates are YYYY-MM-DD creative days, so they are
// formatted as UTC calendar dates (no timezone shift can move them).

import { MissPolicy } from './types'
import type { Milestone, Tally } from './challengeSession'

function utcDate(iso: string): Date | null {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  // Intl throws on an invalid date; corrupt stored data must not crash a page.
  return Number.isNaN(date.getTime()) ? null : date
}

/** "Tuesday 23 September" */
export function longDay(iso: string): string {
  const date = utcDate(iso)
  if (!date) return iso
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date)
}

/** "23 Sep 2026" */
export function shortDate(iso: string): string {
  const date = utcDate(iso)
  if (!date) return iso
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

/** "3:00 am", "midnight", "8:30 pm" for a 24h "HH:MM". */
export function clockTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (h === 0 && m === 0) return 'midnight'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

export const POLICY_NAMES: Record<MissPolicy, string> = {
  classic: 'Classic',
  grace: 'Grace',
  extend: 'Extend',
}

/** The one-line pitch each policy gets when it's chosen at setup. */
export const POLICY_PITCHES: Record<MissPolicy, string> = {
  classic: 'The 75 Hard rule. Any missed day restarts you at Day 1.',
  grace: 'Three skip tokens per attempt. A miss with none left restarts you at Day 1.',
  extend: 'A missed day adds a day to the end. Your streak resets; the challenge carries on.',
}

/** What a miss does, in one line, for the policy's own help text. */
export const POLICY_LINES: Record<MissPolicy, string> = {
  classic: 'A missed day ends the attempt and you restart at Day 1 with the same rules.',
  grace: 'A missed day spends one of this attempt’s three skip tokens and your streak survives. With none left, a miss ends the attempt.',
  extend: 'A missed day is added to the end of the challenge. Your streak restarts; the challenge carries on.',
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * How a finished challenge reads, true to its policy: "made" only when every
 * day was, "done" when skip tokens or extensions carried it to the end.
 */
export function finishLine(t: Tally, totalDays: number): { title: string; detail: string } {
  const clean = t.skipped === 0 && t.missed === 0
  const parts = [plural(t.made, 'day made', 'days made')]
  if (t.skipped > 0) parts.push(`${t.skipped} covered by ${t.skipped === 1 ? 'a skip token' : 'skip tokens'}`)
  if (t.missed > 0) parts.push(`${t.missed} missed and added to the end`)
  const detail = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  // A clean run's count is already the title: say what it means instead.
  return {
    title: `${totalDays} days, ${clean ? 'made' : 'done'}.`,
    detail: clean ? 'Every one of them, no skips and no misses.' : `${detail}.`,
  }
}

/** What completing a milestone day says; `totalDays` is the challenge's real length. */
export function milestoneCopy(m: Milestone, dayIndex: number, totalDays: number): { title: string; sub: string } {
  switch (m) {
    case 'week':
      return { title: 'One week in.', sub: 'The hardest part is starting. You started.' }
    case 'third':
      return { title: 'A third of the way.', sub: `Day ${dayIndex}. This is a habit now, not a whim.` }
    case 'two-thirds':
      return { title: 'Two-thirds done.', sub: `Day ${dayIndex}. ${totalDays - dayIndex} to go. You can see the finish.` }
    case 'final':
      return { title: `${totalDays} days.`, sub: 'You finished. Go see what you made.' }
  }
}
