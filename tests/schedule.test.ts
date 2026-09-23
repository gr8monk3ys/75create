import { describe, it, expect } from 'bun:test'
import { reminderDue, secretMatches, todayNeedsMaking } from '../supabase/functions/_shared/schedule'
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
  const start = { id: 'c1', status: 'active', startDate: '2026-01-01' }
  const noon = new Date('2026-01-05T12:00:00Z') // Day 5

  it('nudges only for an open, unmade day of a running challenge', () => {
    expect(todayNeedsMaking([start], {}, 'UTC', 3, noon)).toBe(true)
    expect(todayNeedsMaking([start], { c1: { completions: { '5': 'x' } } }, 'UTC', 3, noon)).toBe(false)
    expect(todayNeedsMaking([], {}, 'UTC', 3, noon)).toBe(false)
    expect(todayNeedsMaking([{ ...start, status: 'maintenance' }], {}, 'UTC', 3, noon)).toBe(false)
    expect(todayNeedsMaking([{ ...start, startDate: '2026-02-01' }], {}, 'UTC', 3, noon)).toBe(false)
  })

  it('stops after the last day, extensions included', () => {
    const late = new Date('2026-03-17T12:00:00Z') // Day 76
    expect(todayNeedsMaking([start], {}, 'UTC', 3, late)).toBe(false)
    expect(todayNeedsMaking([{ ...start, extraDays: 1 }], {}, 'UTC', 3, late)).toBe(true)
  })

  it('agrees with the app on which creative day it is', () => {
    // 01:30 on Jan 6 with a 3h buffer is still Day 5.
    const small = new Date('2026-01-06T01:30:00Z')
    expect(creativeDate(small, 'UTC', 3)).toBe('2026-01-05')
    expect(todayNeedsMaking([start], { c1: { completions: { '5': 'x' } } }, 'UTC', 3, small)).toBe(false)
    expect(todayNeedsMaking([start], { c1: { completions: { '5': 'x' } } }, 'UTC', 0, small)).toBe(true)
  })
})
