import { describe, it, expect } from 'bun:test'
import { addDays, creativeDate, daysBetween, localDate, localTime } from '@/lib/creativeDay'

describe('creativeDay', () => {
  const lateNight = new Date('2026-03-10T06:30:00Z') // 02:30 in New York (EDT)

  it('reads the local calendar date and time in a timezone', () => {
    expect(localDate(lateNight, 'America/New_York')).toBe('2026-03-10')
    expect(localDate(lateNight, 'Asia/Tokyo')).toBe('2026-03-10')
    expect(localTime(lateNight, 'America/New_York')).toBe('02:30')
    expect(localTime(new Date('2026-03-10T00:05:00Z'), 'UTC')).toBe('00:05')
  })

  it('counts the small hours toward the previous creative day', () => {
    expect(creativeDate(lateNight, 'America/New_York', 3)).toBe('2026-03-09')
    expect(creativeDate(lateNight, 'America/New_York', 0)).toBe('2026-03-10')
  })

  it('does calendar arithmetic across month and year ends', () => {
    expect(daysBetween('2025-12-31', '2026-03-01')).toBe(60)
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})
