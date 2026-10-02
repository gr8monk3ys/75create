// What a missed day costs, in one place for the app (the challenge engine's
// rollover) and the Edge Functions (the reminders' "has this attempt ended?").
// Plain TypeScript with no imports, like creativeDay.ts, so both can use it.

export type MissPolicy = 'classic' | 'grace' | 'extend'

/** The format's base length, before any Extend days. */
export const TOTAL_DAYS = 75
/** Grace's skip tokens per attempt. */
export const MAX_SKIP_TOKENS = 3

/**
 * Whether `misses` more missed days would end the attempt: under Classic any
 * miss does; under Grace, once there aren't tokens enough to cover them;
 * under Extend, never (each one adds a day instead).
 */
export function missesEndAttempt(policy: MissPolicy, tokensUsed: number, misses: number): boolean {
  if (misses <= 0) return false
  if (policy === 'classic') return true
  if (policy === 'grace') return tokensUsed + misses > MAX_SKIP_TOKENS
  return false
}

/** The challenge's length once `pendingExtends` more misses have each added a day. */
export function lengthWith(policy: MissPolicy, extraDays: number, pendingExtends = 0): number {
  return TOTAL_DAYS + extraDays + (policy === 'extend' ? pendingExtends : 0)
}
