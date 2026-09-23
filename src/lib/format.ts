// Human wording for the values the domain stores as data: calendar dates,
// "HH:MM" times, policy ids. Dates are YYYY-MM-DD creative days, so they are
// formatted as UTC calendar dates (no timezone shift can move them).

import { MissPolicy } from './types'

function utcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** "Tuesday 23 September" */
export function longDay(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(utcDate(iso))
}

/** "23 Sep 2026" */
export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcDate(iso))
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

/** What a miss does, in one line, for the policy's own help text. */
export const POLICY_LINES: Record<MissPolicy, string> = {
  classic: 'A missed day ends the attempt and you restart at Day 1 with the same rules.',
  grace: 'A missed day spends one of three skip tokens and your streak survives. With none left, a miss ends the attempt.',
  extend: 'A missed day is added to the end of the challenge. Your streak restarts; the challenge carries on.',
}
