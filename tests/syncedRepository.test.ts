import { describe, it, expect, beforeEach } from 'bun:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LocalRepository } from '@/lib/localRepository'
import { SyncedRepository } from '@/lib/syncedRepository'
import type { Challenge } from '@/lib/types'

interface Call {
  op: string
  table?: string
  row?: Record<string, unknown>
  path?: string
  paths?: string[]
}

interface MockState {
  rows: Record<string, Record<string, unknown>[]>
  calls: Call[]
  failUpserts: boolean
}

function makeMockClient(state: MockState): SupabaseClient {
  const selectResult = (table: string) => {
    const rows = state.rows[table] ?? []
    const thenable = {
      then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    }
    return thenable
  }

  const client = {
    from: (table: string) => ({
      select: () => ({ eq: () => selectResult(table), not: () => selectResult(table) }),
      upsert: (row: Record<string, unknown>) => {
        state.calls.push({ op: 'upsert', table, row })
        return Promise.resolve({
          error: state.failUpserts ? { message: 'nope' } : null,
        })
      },
      delete: () => ({
        eq: () => {
          state.calls.push({ op: 'delete', table })
          return Promise.resolve({ error: null })
        },
      }),
    }),
    storage: {
      from: () => ({
        upload: (path: string) => {
          state.calls.push({ op: 'upload', path })
          return Promise.resolve({ error: null })
        },
        remove: (paths: string[]) => {
          state.calls.push({ op: 'remove', paths })
          return Promise.resolve({ error: null })
        },
        download: () => Promise.resolve({ data: null, error: { message: 'missing' } }),
        list: () => Promise.resolve({ data: [], error: null }),
      }),
    },
  }
  return client as unknown as SupabaseClient
}

function makeChallenge(over: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c1',
    medium: 'writing',
    rules: [],
    missPolicy: 'grace',
    startDate: '2026-01-01',
    status: 'active',
    skipTokensUsed: 0,
    whyNote: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    maintenanceMode: false,
    extraDays: 0,
    ...over,
  }
}

describe('SyncedRepository', () => {
  let state: MockState
  let local: LocalRepository
  let repo: SyncedRepository

  beforeEach(() => {
    localStorage.clear()
    state = { rows: {}, calls: [], failUpserts: false }
    local = new LocalRepository()
    repo = new SyncedRepository(local, makeMockClient(state))
  })

  it('pushes dirty challenges and day data on flush', async () => {
    await repo.connectRemote('uid-1', 'a@b.com')
    state.calls = []

    repo.saveChallenge(makeChallenge())
    repo.saveCheck('c1', 1, 'create', true)
    await repo.flush()

    const tables = state.calls.filter((c) => c.op === 'upsert').map((c) => c.table)
    expect(tables).toContain('challenges')
    expect(tables).toContain('day_data')
    const dayRow = state.calls.find((c) => c.table === 'day_data')!.row!
    expect(dayRow.challenge_id).toBe('c1')
    expect(dayRow.user_id).toBe('uid-1')
    expect((dayRow.data as { checks: Record<string, boolean> }).checks['1:create']).toBe(true)

    // outbox drained
    const outbox = JSON.parse(localStorage.getItem('75create.outbox.v1')!)
    expect(outbox.challenges).toEqual([])
    expect(outbox.dayData).toEqual([])
  })

  it('keeps failed pushes in the outbox for retry', async () => {
    await repo.connectRemote('uid-1', 'a@b.com')
    state.failUpserts = true

    repo.saveChallenge(makeChallenge())
    await repo.flush()

    let outbox = JSON.parse(localStorage.getItem('75create.outbox.v1')!)
    expect(outbox.challenges).toEqual(['c1'])

    state.failUpserts = false
    await repo.flush()
    outbox = JSON.parse(localStorage.getItem('75create.outbox.v1')!)
    expect(outbox.challenges).toEqual([])
  })

  it('hydrates remote state into the local store on connect', async () => {
    const remote = makeChallenge({ id: 'c9', medium: 'drawing' })
    state.rows.challenges = [
      { id: 'c9', data: remote, updated_at: '2099-01-01T00:00:00.000Z' },
    ]
    state.rows.day_data = [
      {
        challenge_id: 'c9',
        data: {
          completions: { 1: '2026-01-01T12:00:00.000Z' },
          logs: {},
          checks: { '1:create': true },
          artifacts: {},
          skips: [],
          actionedMisses: [],
        },
        updated_at: '2099-01-01T00:00:00.000Z',
      },
    ]

    await repo.connectRemote('uid-1', 'a@b.com')

    expect(repo.getChallenges().map((c) => c.id)).toContain('c9')
    const dd = repo.getDayData('c9')
    expect(dd.completions[1]).toBe('2026-01-01T12:00:00.000Z')
    expect(dd.checks['1:create']).toBe(true)
  })

  it('does not fire remote calls when signed out', async () => {
    repo.saveChallenge(makeChallenge())
    await repo.flush()
    expect(state.calls).toEqual([])
  })

  it('wipes remote rows on deleteAllData', async () => {
    await repo.connectRemote('uid-1', 'a@b.com')
    state.calls = []

    await repo.deleteAllData()

    const deletes = state.calls.filter((c) => c.op === 'delete').map((c) => c.table)
    expect(deletes).toEqual(['day_data', 'challenges', 'profiles'])
    expect(repo.getChallenges()).toEqual([])
  })
})
