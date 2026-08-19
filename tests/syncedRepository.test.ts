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
  /** What the database trigger stamps onto a written row. */
  serverNow: string
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
        const error = state.failUpserts ? { message: 'nope' } : null
        // The real client returns a thenable builder: awaiting it gives the
        // write result, and .select().single() gives the stored row back —
        // which is how the server's updated_at reaches us.
        const result = {
          error,
          data: error ? null : { updated_at: state.serverNow },
        }
        return {
          then: (resolve: (v: unknown) => void) => resolve({ error }),
          select: () => ({ single: () => Promise.resolve(result) }),
        }
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
    state = {
      rows: {},
      calls: [],
      failUpserts: false,
      serverNow: '2026-01-01T00:00:00.000000+00:00',
    }
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
  // PostgREST renders timestamptz in the database's timezone, which need not
  // be UTC. Comparing those strings against local "…Z" stamps ordered them by
  // wall-clock text rather than by instant.
  it('keeps newer local data when an older remote row uses a non-UTC offset', async () => {
    await repo.connectRemote('uid-1', 'a@b.com')
    repo.saveChallenge(makeChallenge({ id: 'c1', medium: 'writing' }))
    const localStamp = JSON.parse(localStorage.getItem('75create.stamps.v1')!)
      .challenges.c1 as string
    // One minute earlier, written as +02:00 — lexically greater, actually older.
    const remoteAt = plusOffset(Date.parse(localStamp) - 60_000, 2)

    state.rows.challenges = [
      { id: 'c1', data: makeChallenge({ id: 'c1', medium: 'music' }), updated_at: remoteAt },
    ]
    await repo.connectRemote('uid-1', 'a@b.com')

    expect(repo.getChallenges().find((c) => c.id === 'c1')!.medium).toBe('writing')
  })

  it('takes a newer remote row that uses a non-UTC offset', async () => {
    await repo.connectRemote('uid-1', 'a@b.com')
    repo.saveChallenge(makeChallenge({ id: 'c1', medium: 'writing' }))
    const localStamp = JSON.parse(localStorage.getItem('75create.stamps.v1')!)
      .challenges.c1 as string
    const remoteAt = plusOffset(Date.parse(localStamp) + 60_000, 2)

    state.rows.challenges = [
      { id: 'c1', data: makeChallenge({ id: 'c1', medium: 'music' }), updated_at: remoteAt },
    ]
    await repo.connectRemote('uid-1', 'a@b.com')

    expect(repo.getChallenges().find((c) => c.id === 'c1')!.medium).toBe('music')
  })

  it('adopts the server timestamp as the local stamp after a flush', async () => {
    // Otherwise stamps are client-clock values compared against server-clock
    // rows, and a device running fast wins every comparison forever.
    await repo.connectRemote('uid-1', 'a@b.com')
    repo.saveChallenge(makeChallenge())
    await repo.flush()

    const stamps = JSON.parse(localStorage.getItem('75create.stamps.v1')!)
    expect(stamps.challenges.c1).toBe(state.serverNow)
    expect(stamps.dayData.c1 ?? state.serverNow).toBe(state.serverNow)
  })

  it('never sends updated_at — the database owns it', async () => {
    await repo.connectRemote('uid-1', 'a@b.com')
    state.calls = []

    repo.saveChallenge(makeChallenge())
    repo.saveCheck('c1', 1, 'create', true)
    repo.saveUser({
      id: 'uid-1',
      email: 'a@b.com',
      tz: 'UTC',
      lateNightBufferHrs: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      reminderTime: null,
    })
    await repo.flush()

    const upserts = state.calls.filter((c) => c.op === 'upsert')
    expect(upserts.length).toBeGreaterThan(0)
    for (const call of upserts) {
      expect(call.row).not.toHaveProperty('updated_at')
    }
  })

  it('keeps a local stamp that changed while the flush was in flight', async () => {
    await repo.connectRemote('uid-1', 'a@b.com')
    repo.saveChallenge(makeChallenge())
    const flushing = repo.flush()
    // A mutation lands mid-flush: its local stamp is newer than anything the
    // server just recorded, so the server value must not overwrite it.
    repo.saveChallenge(makeChallenge({ medium: 'music' }))
    await flushing

    const stamps = JSON.parse(localStorage.getItem('75create.stamps.v1')!)
    expect(stamps.challenges.c1).not.toBe(state.serverNow)
  })

  it('keeps a mutation made during a flush queued for the next one', async () => {
    // The outbox used to be pruned by "what succeeded", so a save that landed
    // mid-flush had its entry removed without ever being pushed.
    await repo.connectRemote('uid-1', 'a@b.com')
    repo.saveChallenge(makeChallenge())
    const flushing = repo.flush()
    repo.saveChallenge(makeChallenge({ medium: 'music' }))
    await flushing

    const outbox = JSON.parse(localStorage.getItem('75create.outbox.v1')!)
    expect(outbox.challenges).toEqual(['c1'])

    state.calls = []
    await repo.flush()
    const pushed = state.calls.find((c) => c.table === 'challenges')!.row!
    expect((pushed.data as { medium: string }).medium).toBe('music')
  })

  it('recovers work left in flight when a flush is interrupted', async () => {
    // Simulates the tab closing mid-flush: the claimed work is persisted, so
    // the next flush picks it up instead of silently dropping it.
    localStorage.setItem(
      '75create.inflight.v1',
      JSON.stringify({
        profile: false,
        challenges: ['c1'],
        dayData: [],
        uploadBlobs: [],
        deleteBlobs: [],
      }),
    )
    // Saved through the plain local repo, so nothing else dirties the outbox:
    // the only reason to push this row is the recovered in-flight entry.
    local.saveChallenge(makeChallenge())
    await repo.connectRemote('uid-1', 'a@b.com')

    const tables = state.calls.filter((c) => c.op === 'upsert').map((c) => c.table)
    expect(tables).toContain('challenges')
    expect(JSON.parse(localStorage.getItem('75create.inflight.v1')!).challenges).toEqual(
      [],
    )
  })
})


/** An instant rendered the way PostgREST renders timestamptz at `offsetHrs`. */
function plusOffset(epochMs: number, offsetHrs: number): string {
  const shifted = new Date(epochMs + offsetHrs * 3_600_000).toISOString()
  const sign = offsetHrs < 0 ? '-' : '+'
  const hh = String(Math.abs(offsetHrs)).padStart(2, '0')
  return shifted.replace(/\.(\d{3})Z$/, '.$1456') + `${sign}${hh}:00`
}