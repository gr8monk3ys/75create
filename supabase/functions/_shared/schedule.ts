// Scheduling helpers shared by the reminder senders (email and push). Plain
// TypeScript with no Deno APIs, so bun tests import it directly.

function localMinutes(tz: string, now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return g('hour') * 60 + g('minute')
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
// The same creative-day rule as the app (src/lib/creativeDay.ts): the local
// date with the clock shifted back by the late-night buffer. Repeated here
// because Edge Functions deploy on their own; a bun test holds the two copies
// to the same answers.

const BASE_DAYS = 75

function creativeDate(now: Date, tz: string, bufferHrs: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now.getTime() - bufferHrs * 3_600_000))
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${g('year')}-${g('month')}-${g('day')}`
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** The stored shape the senders read (a subset of the app's Challenge). */
export interface StoredChallenge {
  id: string
  status: string
  startDate: string
  extraDays?: number
}

/** The stored shape of a challenge's day data (a subset of the app's DayData). */
export interface StoredDayData {
  completions?: Record<string, string>
}

/**
 * Whether a reminder has anything to remind about: a running challenge whose
 * creative day today has started, isn't past the last day, and isn't made
 * yet. No challenge, a future start, a finished round or maintenance, or a
 * day already made: no nudge.
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
  if (!Number.isFinite(index) || index < 1 || index > BASE_DAYS + (active.extraDays ?? 0)) return false
  return !dayData[active.id]?.completions?.[String(index)]
}
