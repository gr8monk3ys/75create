// The creative day: the calendar date a moment belongs to for the challenge.
// It is the user's local date with the clock shifted back by the late-night
// buffer, so 1:30am on Tuesday still counts as Monday's work. Every "what day
// is it" question in the app goes through here, so the grid, setup, resets and
// reminders can never disagree about which day is today.

/** The local YYYY-MM-DD for an instant in a timezone (no buffer applied). */
export function localDate(now: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** The creative day (YYYY-MM-DD) an instant belongs to. */
export function creativeDate(now: Date, tz: string, bufferHrs: number): string {
  return localDate(new Date(now.getTime() - bufferHrs * 3_600_000), tz)
}

/** Local wall-clock time as "HH:MM" (24h) in a timezone. */
export function localTime(now: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return `${get('hour')}:${get('minute')}`
}

/** Whole calendar days between two YYYY-MM-DD strings (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** A YYYY-MM-DD date shifted by a number of calendar days. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
