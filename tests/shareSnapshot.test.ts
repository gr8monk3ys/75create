import { describe, it, expect } from 'bun:test'
import {
  encodeSnapshot,
  decodeSnapshot,
  type ShareSnapshot,
} from '@/lib/shareSnapshot'

function sample(): ShareSnapshot {
  return {
    medium: 'writing',
    startDate: '2026-01-01',
    missPolicy: 'grace',
    dayStates: ['complete', 'complete', 'missed', 'today', 'future'],
    current: 4,
    longest: 2,
    includeLogs: true,
    logs: { 1: 'first day', 2: 'second day' },
  }
}

describe('shareSnapshot codec', () => {
  it('round-trips a payload', () => {
    const p = sample()
    expect(decodeSnapshot(encodeSnapshot(p))).toEqual(p)
  })

  it('produces a URL-safe string (no +, /, or =)', () => {
    const s = encodeSnapshot(sample())
    expect(s).not.toMatch(/[+/=]/)
  })

  it('round-trips without logs', () => {
    const p: ShareSnapshot = { ...sample(), includeLogs: false, logs: {} }
    expect(decodeSnapshot(encodeSnapshot(p))).toEqual(p)
  })

  it('carries the day index, and drops a malformed one', () => {
    const p: ShareSnapshot = { ...sample(), dayIndex: 4 }
    expect(decodeSnapshot(encodeSnapshot(p))?.dayIndex).toBe(4)
    const bad = encodeSnapshot({ ...sample(), dayIndex: 'x' as unknown as number })
    expect(decodeSnapshot(bad)?.dayIndex).toBeUndefined()
  })

  it('carries the date it was taken, and drops a malformed one', () => {
    expect(decodeSnapshot(encodeSnapshot({ ...sample(), takenAt: '2026-09-23' }))?.takenAt).toBe('2026-09-23')
    const bad = encodeSnapshot({ ...sample(), takenAt: '<script>' })
    expect(decodeSnapshot(bad)?.takenAt).toBeUndefined()
  })

  it('returns null for a malformed fragment', () => {
    expect(decodeSnapshot('not-valid-base64!!')).toBeNull()
  })
})

describe('decodeSnapshot on untrusted links', () => {
  it('rejects unknown day states and repairs missing fields', () => {
    const enc = (o: unknown) => encodeSnapshot(o as never)
    expect(decodeSnapshot(enc({ dayStates: ['complete', 'evil'] }))).toBeNull()
    const snap = decodeSnapshot(enc({ dayStates: ['complete'], includeLogs: true }))
    expect(snap?.logs).toEqual({})
    expect(snap?.missPolicy).toBe('classic')
  })
})
