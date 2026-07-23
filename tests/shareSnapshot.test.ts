import { describe, it, expect } from 'vitest'
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

  it('returns null for a malformed fragment', () => {
    expect(decodeSnapshot('not-valid-base64!!')).toBeNull()
  })
})
