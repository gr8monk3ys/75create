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

describe('mergeDayData carries undos', () => {
  const at = (t: string) => `2026-01-05T${t}:00.000Z`

  it('an untick made later wins over a stale tick', () => {
    const stale = { ...emptyDayData(), checks: { '5:create': true }, changedAt: { 'k:5:create': at('10:00') } }
    const unticked = { ...emptyDayData(), checks: { '5:create': false }, changedAt: { 'k:5:create': at('11:00') } }
    expect(mergeDayData(unticked, stale).checks['5:create']).toBe(false)
    expect(mergeDayData(stale, unticked).checks['5:create']).toBe(false)
  })

  it('a day reopened later stays open; one made later stays made', () => {
    const made = { ...emptyDayData(), completions: { 5: at('10:00') }, changedAt: { 'c:5': at('10:00') } }
    const reopened = { ...emptyDayData(), changedAt: { 'c:5': at('11:00') } }
    expect(mergeDayData(made, reopened).completions[5]).toBeUndefined()
    expect(mergeDayData(reopened, made).completions[5]).toBeUndefined()
    const remade = { ...made, completions: { 5: at('12:00') }, changedAt: { 'c:5': at('12:00') } }
    expect(mergeDayData(reopened, remade).completions[5]).toBe(at('12:00'))
  })

  it('a removed artifact never comes back from a copy that still has it', () => {
    const art = { id: 'a1', dayId: 'c1:5', kind: 'image' as const, blobRef: 'b1', createdAt: at('10:00') }
    const stale = { ...emptyDayData(), artifacts: { 5: [art] } }
    const removed = { ...emptyDayData(), artifacts: { 5: [] }, removedArtifacts: ['a1'] }
    expect(mergeDayData(stale, removed).artifacts[5]).toEqual([])
    expect(mergeDayData(removed, stale).removedArtifacts).toEqual(['a1'])
  })
})
