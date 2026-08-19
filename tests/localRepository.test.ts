import { describe, it, expect, beforeEach } from 'bun:test'
import { LocalRepository } from '@/lib/localRepository'
import type { Challenge, User } from '@/lib/types'

function makeUser(): User {
  return {
    id: 'u1',
    email: 'a@b.com',
    tz: 'UTC',
    lateNightBufferHrs: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    reminderTime: null,
  }
}

function makeChallenge(over: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c1',
    medium: 'writing',
    rules: [],
    missPolicy: 'classic',
    startDate: '2026-01-01',
    status: 'active',
    skipTokensUsed: 0,
    whyNote: 'because',
    createdAt: '2026-01-01T00:00:00.000Z',
    maintenanceMode: false,
    extraDays: 0,
    ...over,
  }
}

describe('LocalRepository structured data', () => {
  let repo: LocalRepository
  beforeEach(async () => {
    localStorage.clear()
    repo = new LocalRepository()
    await repo.deleteAllData()
  })

  it('round-trips the user', () => {
    const u = makeUser()
    repo.saveUser(u)
    expect(repo.getUser()).toEqual(u)
  })

  it('saves and finds the active challenge', () => {
    repo.saveChallenge(makeChallenge())
    expect(repo.getActiveChallenge()?.id).toBe('c1')
  })

  it('excludes archived and completed from active', () => {
    repo.saveChallenge(makeChallenge({ id: 'old', status: 'archived' }))
    repo.saveChallenge(makeChallenge({ id: 'done', status: 'completed' }))
    expect(repo.getActiveChallenge()).toBeNull()
    expect(repo.getChallenges()).toHaveLength(2)
  })

  it('updates a challenge in place on re-save', () => {
    repo.saveChallenge(makeChallenge())
    repo.saveChallenge(makeChallenge({ skipTokensUsed: 2 }))
    expect(repo.getChallenges()).toHaveLength(1)
    expect(repo.getActiveChallenge()?.skipTokensUsed).toBe(2)
  })

  it('stores day completions, logs, and checks', () => {
    repo.saveChallenge(makeChallenge())
    repo.saveDayCompletion('c1', 1, '2026-01-01T20:00:00Z')
    repo.saveLog('c1', 1, { dayId: 'c1:1', text: 'made a thing', updatedAt: 'x' })
    repo.saveCheck('c1', 1, 'create', true)
    const dd = repo.getDayData('c1')
    expect(dd.completions[1]).toBe('2026-01-01T20:00:00Z')
    expect(dd.logs[1].text).toBe('made a thing')
    expect(dd.checks['1:create']).toBe(true)
  })

  it('deleteAllData clears everything', async () => {
    repo.saveUser(makeUser())
    repo.saveChallenge(makeChallenge())
    await repo.deleteAllData()
    expect(repo.getUser()).toBeNull()
    expect(repo.getChallenges()).toHaveLength(0)
  })
})

describe('LocalRepository artifact blobs', () => {
  let repo: LocalRepository
  beforeEach(async () => {
    localStorage.clear()
    repo = new LocalRepository()
    await repo.deleteAllData()
  })

  it('saves, reads, and deletes a blob', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/png' })
    const id = await repo.saveArtifactBlob(blob)
    expect(typeof id).toBe('string')
    const got = await repo.getArtifactBlob(id)
    expect(got).not.toBeNull()
    expect(got!.size).toBe(5)
    await repo.deleteArtifactBlob(id)
    expect(await repo.getArtifactBlob(id)).toBeNull()
  })
  it('leaves no storage behind after deleteAllData, even if sign-out follows', async () => {
    const repo = new LocalRepository()
    repo.saveUser(makeUser())
    repo.saveChallenge(makeChallenge())
    repo.setSignedIn(true)

    await repo.deleteAllData()
    // The settings page signs out immediately after wiping; that must not
    // re-create the record the user just deleted.
    repo.setSignedIn(false)

    expect(localStorage.getItem('75create.v1')).toBeNull()
    expect(repo.getUser()).toBeNull()
    expect(repo.getChallenges()).toEqual([])
    expect(repo.isSignedIn()).toBe(false)
  })
})
