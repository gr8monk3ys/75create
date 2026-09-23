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
