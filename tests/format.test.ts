import { describe, it, expect } from 'bun:test'
import { clockTime, finishLine, longDay, milestoneCopy, shortDate } from '@/lib/format'

describe('format', () => {
  it('formats creative days without any timezone shift', () => {
    expect(longDay('2026-09-23')).toBe('Wednesday 23 September')
    expect(shortDate('2026-01-01')).toBe('1 Jan 2026')
  })

  it('never throws on corrupt dates', () => {
    expect(longDay('not-a-date')).toBe('not-a-date')
    expect(shortDate('')).toBe('')
  })

  it('formats clock times the way people say them', () => {
    expect(clockTime('03:00')).toBe('3:00 am')
    expect(clockTime('00:00')).toBe('midnight')
    expect(clockTime('12:00')).toBe('12:00 pm')
    expect(clockTime('20:30')).toBe('8:30 pm')
  })
})

describe('finishLine', () => {
  const t = { made: 75, skipped: 0, missed: 0, logsWritten: 0, artifactsKept: 0 }
  it('says "made" only when every day was', () => {
    expect(finishLine(t, 75)).toEqual({ title: '75 days, made.', detail: 'Every one of them, no skips and no misses.' })
  })
  it('names skip tokens and extensions', () => {
    expect(finishLine({ ...t, made: 73, skipped: 2 }, 75)).toEqual({
      title: '75 days, done.',
      detail: '73 days made and 2 covered by skip tokens.',
    })
    expect(finishLine({ ...t, missed: 1 }, 76).detail).toBe('75 days made and 1 missed and added to the end.')
  })
})

describe('milestoneCopy', () => {
  it('counts down from the real length', () => {
    expect(milestoneCopy('two-thirds', 50, 77).sub).toContain('27 to go')
    expect(milestoneCopy('final', 77, 77).title).toBe('77 days.')
  })
})
