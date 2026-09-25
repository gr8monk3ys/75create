import { describe, it, expect } from 'bun:test'
import { addDays, creativeDate, dayWindow, daysBetween, localDate, localTime } from '@/lib/creativeDay'

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

describe('dayWindow', () => {
  // The close is where creativeDate itself moves on: a minute before it is
  // still the day, the close is the next one.
  function agrees(now: Date, tz: string, buffer: number) {
    const { date, closesAt } = dayWindow(now, tz, buffer)
    expect(date).toBe(creativeDate(now, tz, buffer))
    expect(creativeDate(new Date(closesAt.getTime() - 60_000), tz, buffer)).toBe(date)
    expect(creativeDate(closesAt, tz, buffer)).not.toBe(date)
    expect(closesAt.getTime()).toBeGreaterThan(now.getTime())
    return closesAt
  }

  it('closes at 3:00 am the next morning on an ordinary night', () => {
    expect(agrees(new Date('2026-09-23T12:00:00Z'), 'UTC', 3).toISOString()).toBe('2026-09-24T03:00:00.000Z')
  })

  it('stays true to the rule across clock changes', () => {
    // New York falling back (1 Nov 2026) and springing forward (8 Mar 2026),
    // London's spring change, and a zone that changes at midnight.
    const cases: [string, string][] = [
      ['America/New_York', '2026-11-01T06:30:00Z'],
      ['America/New_York', '2026-11-01T03:00:00Z'],
      ['America/New_York', '2026-03-08T07:30:00Z'],
      ['Europe/London', '2026-03-29T01:30:00Z'],
      ['America/Santiago', '2026-09-06T03:30:00Z'],
      ['Asia/Kolkata', '2026-09-23T20:00:00Z'],
    ]
    for (const [tz, at] of cases) for (const buffer of [0, 3, 6]) agrees(new Date(at), tz, buffer)
  })

  it('agrees with the rule every 20 minutes through a fall-back weekend', () => {
    const from = Date.parse('2026-10-31T00:00:00Z')
    for (let t = from; t < from + 72 * 3_600_000; t += 20 * 60_000) agrees(new Date(t), 'America/New_York', 3)
  })

  it('says the close in local time', () => {
    const { closesAt } = dayWindow(new Date('2026-09-23T12:00:00Z'), 'America/New_York', 3)
    expect(localTime(closesAt, 'America/New_York')).toBe('03:00')
  })
})
