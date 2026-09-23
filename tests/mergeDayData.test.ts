import { describe, it, expect } from 'bun:test'
import { emptyDayData, mergeDayData } from '@/lib/repository'

const log = (text: string, updatedAt: string) => ({ dayId: 'c:1', text, updatedAt })

describe('mergeDayData', () => {
  it('keeps everything either copy made', () => {
    const a = { ...emptyDayData(), completions: { 1: '2026-01-01T10:00:00Z' }, skips: [2], actionedMisses: [2] }
    const b = { ...emptyDayData(), completions: { 2: '2026-01-02T10:00:00Z' }, checks: { '3:x': true } }
    const m = mergeDayData(a, b)
    expect(Object.keys(m.completions).sort()).toEqual(['1', '2'])
    expect(m.checks['3:x']).toBe(true)
    expect(m.skips).toEqual([2])
    expect(m.actionedMisses).toEqual([2])
  })

  it('keeps the newest log per day and the earliest completion', () => {
    const a = { ...emptyDayData(), logs: { 1: log('typed offline', '2026-01-01T22:00:00Z') }, completions: { 1: '2026-01-01T22:00:00Z' } }
    const b = { ...emptyDayData(), logs: { 1: log('first', '2026-01-01T20:00:00Z') }, completions: { 1: '2026-01-01T20:00:00Z' } }
    const m = mergeDayData(a, b)
    expect(m.logs[1].text).toBe('typed offline')
    expect(m.completions[1]).toBe('2026-01-01T20:00:00Z')
    expect(mergeDayData(b, a).logs[1].text).toBe('typed offline')
  })

  it('unions artifacts by id without duplicates', () => {
    const art = (id: string, createdAt: string) => ({ id, dayId: 'c:1', kind: 'url' as const, url: 'https://x.co', createdAt })
    const a = { ...emptyDayData(), artifacts: { 1: [art('p', '1'), art('q', '2')] } }
    const b = { ...emptyDayData(), artifacts: { 1: [art('q', '2'), art('r', '3')] } }
    expect(mergeDayData(a, b).artifacts[1].map((x) => x.id)).toEqual(['p', 'q', 'r'])
  })
})
