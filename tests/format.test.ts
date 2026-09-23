import { describe, it, expect } from 'bun:test'
import { clockTime, longDay, shortDate } from '@/lib/format'

describe('format', () => {
  it('formats creative days without any timezone shift', () => {
    expect(longDay('2026-09-23')).toBe('Wednesday 23 September')
    expect(shortDate('2026-01-01')).toBe('1 Jan 2026')
  })

  it('formats clock times the way people say them', () => {
    expect(clockTime('03:00')).toBe('3:00 am')
    expect(clockTime('00:00')).toBe('midnight')
    expect(clockTime('12:00')).toBe('12:00 pm')
    expect(clockTime('20:30')).toBe('8:30 pm')
  })
})
