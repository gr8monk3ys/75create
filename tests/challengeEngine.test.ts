import { describe, it, expect } from 'vitest'
import {
  currentDayIndex,
  computeDayStates,
  streaks,
  applyMissPolicy,
} from '@/lib/challengeEngine'
import type { Challenge } from '@/lib/types'

function makeChallenge(over: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c1',
    medium: 'writing',
    rules: [],
    missPolicy: 'classic',
    startDate: '2026-01-01',
    status: 'active',
    skipTokensUsed: 0,
    whyNote: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    maintenanceMode: false,
    extraDays: 0,
    ...over,
  }
}

describe('currentDayIndex', () => {
  const c = makeChallenge()

  it('is 1 on the start date', () => {
    expect(currentDayIndex(c, new Date('2026-01-01T10:00:00Z'), 'UTC', 3)).toBe(1)
  })

  it('is 0 before the start date', () => {
    expect(currentDayIndex(c, new Date('2025-12-31T10:00:00Z'), 'UTC', 3)).toBe(0)
  })

  it('is 2 on the next day after the buffer', () => {
    expect(currentDayIndex(c, new Date('2026-01-02T09:00:00Z'), 'UTC', 3)).toBe(2)
  })

  it('late-night buffer: 2am counts as the previous day', () => {
    expect(currentDayIndex(c, new Date('2026-01-02T02:00:00Z'), 'UTC', 3)).toBe(1)
  })

  it('respects timezone: New York evening is still the same local day', () => {
    // 2026-01-02T02:00:00Z is 2026-01-01 21:00 in New York → local day 1.
    expect(
      currentDayIndex(c, new Date('2026-01-02T02:00:00Z'), 'America/New_York', 3),
    ).toBe(1)
  })
})

describe('computeDayStates', () => {
  const c = makeChallenge()

  it('marks completed, missed, today, and future correctly', () => {
    const completions = {
      1: '2026-01-01T20:00:00Z',
      2: '2026-01-02T20:00:00Z',
      3: '2026-01-03T20:00:00Z',
    }
    const now = new Date('2026-01-05T10:00:00Z') // day 5
    const days = computeDayStates(c, completions, now, 'UTC', 3)
    expect(days).toHaveLength(75)
    expect(days[0].state).toBe('complete')
    expect(days[2].state).toBe('complete')
    expect(days[3].state).toBe('missed') // day 4
    expect(days[4].state).toBe('today') // day 5
    expect(days[5].state).toBe('future') // day 6
  })

  it('extends length by extraDays for the Extend policy', () => {
    const ext = makeChallenge({ missPolicy: 'extend', extraDays: 2 })
    const days = computeDayStates(ext, {}, new Date('2026-01-01T10:00:00Z'), 'UTC', 3)
    expect(days).toHaveLength(77)
  })
})

describe('streaks', () => {
  const c = makeChallenge()

  it('counts a clean run', () => {
    const completions: Record<number, string> = {}
    for (let i = 1; i <= 10; i++) completions[i] = '2026-01-01T20:00:00Z'
    const now = new Date('2026-01-10T21:00:00Z') // day 10, already complete
    const days = computeDayStates(c, completions, now, 'UTC', 3)
    expect(streaks(days, 10)).toEqual({ current: 10, longest: 10 })
  })

  it('resets current streak after a gap but keeps longest', () => {
    const completions: Record<number, string> = {
      1: 'x', 2: 'x', 3: 'x', // run of 3
      // day 4 missed
      5: 'x', 6: 'x', // run of 2 ending today
    }
    const now = new Date('2026-01-06T21:00:00Z') // day 6, complete
    const days = computeDayStates(c, completions, now, 'UTC', 3)
    expect(streaks(days, 6)).toEqual({ current: 2, longest: 3 })
  })
})

describe('applyMissPolicy', () => {
  function daysWithMiss() {
    // day 1 complete, day 2 missed, day 3 = today
    const c = makeChallenge()
    const completions = { 1: '2026-01-01T20:00:00Z' }
    const now = new Date('2026-01-03T10:00:00Z')
    return { c, days: computeDayStates(c, completions, now, 'UTC', 3), current: 3 }
  }

  it('classic resets on any miss', () => {
    const { c, days, current } = daysWithMiss()
    const r = applyMissPolicy(c, days, current)
    expect(r.action).toBe('reset')
    expect(r.message.toLowerCase()).toContain('day 1')
  })

  it('grace spends a skip token', () => {
    const { days, current } = daysWithMiss()
    const c = makeChallenge({ missPolicy: 'grace', skipTokensUsed: 0 })
    const r = applyMissPolicy(c, days, current)
    expect(r.action).toBe('skip')
    expect(r.newSkipTokensUsed).toBe(1)
    expect(r.message).toContain('1 of 3')
  })

  it('grace resets after the tokens are gone', () => {
    const { days, current } = daysWithMiss()
    const c = makeChallenge({ missPolicy: 'grace', skipTokensUsed: 3 })
    const r = applyMissPolicy(c, days, current)
    expect(r.action).toBe('reset')
  })

  it('extend adds a day', () => {
    const { days, current } = daysWithMiss()
    const c = makeChallenge({ missPolicy: 'extend', extraDays: 0 })
    const r = applyMissPolicy(c, days, current)
    expect(r.action).toBe('extend')
    expect(r.extraDays).toBe(1)
  })

  it('does nothing when there are no missed days', () => {
    const c = makeChallenge()
    const days = computeDayStates(c, { 1: 'x' }, new Date('2026-01-02T10:00:00Z'), 'UTC', 3)
    const r = applyMissPolicy(c, days, 2)
    expect(r.action).toBe('none')
  })
})
