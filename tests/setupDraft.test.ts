import { describe, it, expect, beforeEach } from 'bun:test'
import { clearSetupDraft, readSetupDraft, writeSetupDraft, type SetupDraft } from '@/lib/setupDraft'
import { DEFAULT_RULES } from '@/lib/types'

const draft: SetupDraft = {
  step: 2,
  medium: 'drawing',
  rules: DEFAULT_RULES.map((r) => ({ ...r })),
  policy: 'grace',
  startChoice: 'future',
  futureDate: '2026-10-01',
  why: 'to finish things',
}

beforeEach(() => sessionStorage.clear())

describe('setup draft', () => {
  it('comes back for the account that wrote it', () => {
    writeSetupDraft('u1', draft)
    expect(readSetupDraft('u1', '2026-09-24')).toEqual(draft)
  })

  it('never reaches another account on the same tab', () => {
    writeSetupDraft('u1', draft)
    expect(readSetupDraft('u2')).toBeNull()
  })

  it('drops a start date that has since passed', () => {
    writeSetupDraft('u1', draft)
    expect(readSetupDraft('u1', '2026-10-05')?.futureDate).toBe('')
  })

  it('starts fresh from a malformed draft rather than throwing later', () => {
    writeSetupDraft('u1', { ...draft, rules: [{ id: 'x', name: 3 } as never] })
    expect(readSetupDraft('u1')).toBeNull()
    sessionStorage.setItem('75create.setupDraft', '{not json')
    expect(readSetupDraft('u1')).toBeNull()
  })

  it('is forgotten when cleared', () => {
    writeSetupDraft('u1', draft)
    clearSetupDraft()
    expect(readSetupDraft('u1')).toBeNull()
  })
})
