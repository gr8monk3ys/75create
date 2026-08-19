// The user's timezone decides when their day rolls over, so a stale one is a
// correctness problem, not a preference: someone who flies from Los Angeles to
// Berlin keeps a day boundary eight hours off, and under Classic mode that
// reads as a missed day and prompts a reset.

/** The IANA timezone this device is in, or null if the browser won't say. */
export function detectTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

/** The stored timezone, or a sane fallback when nothing is stored yet. */
export function resolveTimezone(stored: string | null | undefined): string {
  return stored || detectTimezone() || 'UTC'
}
