import { describe, it, expect } from 'bun:test'
import { BASE_DAYS, reminderDue, secretMatches, todayNeedsMaking } from '../supabase/functions/_shared/schedule'
import { TOTAL_DAYS } from '@/lib/types'
import { creativeDate } from '@/lib/creativeDay'

describe('reminderDue', () => {
  const at = (iso: string) => new Date(iso)

  it('is due from the reminder time until the window closes', () => {
    expect(reminderDue('20:00', 'UTC', at('2026-01-01T20:00:00Z'), 15)).toBe(true)
    expect(reminderDue('20:00', 'UTC', at('2026-01-01T20:14:00Z'), 15)).toBe(true)
    expect(reminderDue('20:00', 'UTC', at('2026-01-01T20:15:00Z'), 15)).toBe(false)
    expect(reminderDue('20:00', 'UTC', at('2026-01-01T19:59:00Z'), 15)).toBe(false)
  })

  it('wraps midnight, so late-evening reminders are sent', () => {
    expect(reminderDue('23:55', 'UTC', at('2026-01-02T00:05:00Z'), 15)).toBe(true)
    expect(reminderDue('23:55', 'UTC', at('2026-01-02T00:10:00Z'), 15)).toBe(false)
  })

  it('reads the time in the user timezone and accepts Postgres HH:MM:SS', () => {
    // 20:00 in Tokyo is 11:00 UTC.
    expect(reminderDue('20:00:00', 'Asia/Tokyo', at('2026-01-01T11:05:00Z'), 15)).toBe(true)
    expect(reminderDue('20:00:00', 'Asia/Tokyo', at('2026-01-01T20:05:00Z'), 15)).toBe(false)
  })

  it('falls back to UTC on a bad zone and rejects a bad time', () => {
    expect(reminderDue('20:00', 'Not/AZone', at('2026-01-01T20:01:00Z'), 15)).toBe(true)
    expect(reminderDue(null, 'UTC', at('2026-01-01T20:01:00Z'), 15)).toBe(false)
    expect(reminderDue('soon', 'UTC', at('2026-01-01T20:01:00Z'), 15)).toBe(false)
  })
})

describe('secretMatches', () => {
  it('matches only the exact secret', () => {
    expect(secretMatches('s3cret', 's3cret')).toBe(true)
    expect(secretMatches('s3creT', 's3cret')).toBe(false)
    expect(secretMatches('s3cre', 's3cret')).toBe(false)
    expect(secretMatches(null, 's3cret')).toBe(false)
  })
})

describe('todayNeedsMaking', () => {
  const start = { id: 'c1', status: 'active', startDate: '2026-01-01', missPolicy: 'classic' as const }
  const noon = new Date('2026-01-05T12:00:00Z') // Day 5
  /** Days 1..n made. */
  const made = (n: number, extra: Record<string, string> = {}) => {
    const completions: Record<string, string> = { ...extra }
    for (let d = 1; d <= n; d++) completions[String(d)] = 'x'
    return completions
  }

  it('nudges only for an open, unmade day of a running challenge', () => {
    expect(todayNeedsMaking([start], { c1: { completions: made(4) } }, 'UTC', 3, noon)).toBe(true)
    expect(todayNeedsMaking([start], { c1: { completions: made(5) } }, 'UTC', 3, noon)).toBe(false)
    expect(todayNeedsMaking([], {}, 'UTC', 3, noon)).toBe(false)
    expect(todayNeedsMaking([{ ...start, status: 'maintenance' }], {}, 'UTC', 3, noon)).toBe(false)
    expect(todayNeedsMaking([{ ...start, startDate: '2026-02-01' }], {}, 'UTC', 3, noon)).toBe(false)
  })

  it('stays quiet once a miss has ended the attempt, before the app rolls over', () => {
    const gap = { c1: { completions: made(3) } } // Day 4 missed
    expect(todayNeedsMaking([start], gap, 'UTC', 3, noon)).toBe(false)
    const grace = { ...start, missPolicy: 'grace' as const }
    expect(todayNeedsMaking([{ ...grace, skipTokensUsed: 1 }], gap, 'UTC', 3, noon)).toBe(true)
    expect(todayNeedsMaking([{ ...grace, skipTokensUsed: 3 }], gap, 'UTC', 3, noon)).toBe(false)
    // A miss the app already covered with a token counts as settled.
    const covered = { c1: { completions: made(3), skips: [4], actionedMisses: [4] } }
    expect(todayNeedsMaking([{ ...grace, skipTokensUsed: 3 }], covered, 'UTC', 3, noon)).toBe(true)
  })

  it('stops after the last day, extensions (applied or pending) included', () => {
    const late = new Date('2026-03-17T12:00:00Z') // Day 76
    expect(todayNeedsMaking([start], { c1: { completions: made(75) } }, 'UTC', 3, late)).toBe(false)
    const extend = { ...start, missPolicy: 'extend' as const }
    expect(todayNeedsMaking([{ ...extend, extraDays: 1 }], { c1: { completions: made(75) } }, 'UTC', 3, late)).toBe(true)
    const oneMissed = made(75)
    delete oneMissed['40']
    expect(todayNeedsMaking([extend], { c1: { completions: oneMissed } }, 'UTC', 3, late)).toBe(true)
  })

  it('reads the creative day the way the app does (one shared module)', () => {
    // 01:30 on Jan 6 with a 3h buffer is still Day 5.
    const small = new Date('2026-01-06T01:30:00Z')
    expect(creativeDate(small, 'UTC', 3)).toBe('2026-01-05')
    expect(todayNeedsMaking([start], { c1: { completions: made(5) } }, 'UTC', 3, small)).toBe(false)
    expect(todayNeedsMaking([start], { c1: { completions: made(5) } }, 'UTC', 0, small)).toBe(true)
    expect(BASE_DAYS).toBe(TOTAL_DAYS)
  })
})
