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
    functions: {
      invoke: (name: string) => {
        state.calls.push({ op: 'invoke', table: name })
        return Promise.resolve({ data: { deleted: true }, error: null })
      },
    },
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

  it('merges a newer remote day row instead of replacing local work', async () => {
    await repo.connectRemote('uid-1', 'a@b.com')
    repo.saveChallenge(makeChallenge())
    // Made on this device, not yet pushed (offline).
    state.failUpserts = true
    repo.saveDayCompletion('c1', 2, '2026-01-02T21:00:00.000Z')
    repo.saveLog('c1', 2, { dayId: 'c1:2', text: 'typed offline', updatedAt: '2026-01-02T21:00:00.000Z' })
    await repo.flush()

    // Meanwhile another device wrote Day 3 and an older Day 2 log.
    state.rows.day_data = [
      {
        challenge_id: 'c1',
        data: {
          completions: { 3: '2026-01-03T12:00:00.000Z' },
          logs: { 2: { dayId: 'c1:2', text: 'first', updatedAt: '2026-01-02T20:00:00.000Z' } },
          checks: {},
          artifacts: {},
          skips: [],
          actionedMisses: [],
        },
        updated_at: '2099-01-01T00:00:00.000Z',
      },
    ]
    state.failUpserts = false
    await repo.pull()

    const dd = repo.getDayData('c1')
    expect(Object.keys(dd.completions).sort()).toEqual(['2', '3'])
    expect(dd.logs[2].text).toBe('typed offline')
    // What the merge added went back up.
    const pushed = state.calls.filter((c) => c.op === 'upsert' && c.table === 'day_data').at(-1)!.row!
    expect(Object.keys((pushed.data as { completions: object }).completions).sort()).toEqual(['2', '3'])
  })

  it('never erases remote work on push, even when the local stamp reads newer', async () => {
    await repo.connectRemote('uid-1', 'a@b.com')
    repo.saveChallenge(makeChallenge())
    await repo.flush()
    // Another device made Day 5 and pushed it.
    state.rows.day_data = [
      {
        challenge_id: 'c1',
        data: { completions: { 5: '2026-01-05T20:00:00.000Z' }, logs: {}, checks: {}, artifacts: {}, skips: [], actionedMisses: [] },
        updated_at: '2026-01-05T20:00:00.000000+00:00',
      },
    ]
    // This device edits something else and pushes, without pulling first.
    repo.saveCheck('c1', 6, 'create', true)
    await repo.flush()
    const pushed = state.calls.filter((c) => c.op === 'upsert' && c.table === 'day_data').at(-1)!.row!
    const data = pushed.data as { completions: Record<string, string>; checks: Record<string, boolean> }
    expect(data.completions['5']).toBe('2026-01-05T20:00:00.000Z')
    expect(data.checks['6:create']).toBe(true)
    expect(repo.getDayData('c1').completions[5]).toBe('2026-01-05T20:00:00.000Z')
  })

  it('carries an untick made here over the other device’s older tick', async () => {
    await repo.connectRemote('uid-1', 'a@b.com')
    repo.saveChallenge(makeChallenge())
    state.rows.day_data = [
      {
        challenge_id: 'c1',
        data: {
          completions: {},
          logs: {},
          checks: { '6:create': true },
          changedAt: { 'k:6:create': '2000-01-01T00:00:00.000Z' },
          artifacts: {},
          skips: [],
          actionedMisses: [],
        },
        updated_at: '2099-01-01T00:00:00.000Z',
      },
    ]
    repo.saveCheck('c1', 6, 'create', false)
    await repo.pull()
    expect(repo.getDayData('c1').checks['6:create']).toBe(false)
  })

  it('does not re-push a day row whose content only differs in key order', async () => {
    await repo.connectRemote('uid-1', 'a@b.com')
    repo.saveChallenge(makeChallenge())
    repo.saveCheck('c1', 1, 'sketch', true)
    repo.saveCheck('c1', 1, 'log', true)
    await repo.flush()
    const local = repo.getDayData('c1')
    // The same content, keys reordered the way jsonb stores them.
    const reordered = JSON.parse(JSON.stringify(local, (_k, v) =>
      v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v,
    ))
    state.rows.day_data = [{ challenge_id: 'c1', data: reordered, updated_at: '2099-01-01T00:00:00.000Z' }]
    state.calls = []
    await repo.pull()
    expect(state.calls.filter((c) => c.op === 'upsert' && c.table === 'day_data')).toEqual([])
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
    // The auth user itself needs the service role, so it goes through the
    // delete-account function rather than staying behind.
    expect(state.calls.some((c) => c.op === 'invoke' && c.table === 'delete-account')).toBe(
      true,
    )
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

  it('stamps only the row a write touched', async () => {
    await repo.connectRemote('uid-1', 'a@b.com')
    state.failUpserts = true // keep everything queued
    repo.saveChallenge(makeChallenge({ id: 'c1' }))
    const first = JSON.parse(localStorage.getItem('75create.stamps.v1')!).challenges.c1
    await new Promise((r) => setTimeout(r, 5))
    repo.saveChallenge(makeChallenge({ id: 'c2' }))
    const stamps = JSON.parse(localStorage.getItem('75create.stamps.v1')!)
    // c1 is still queued, but nothing touched it: its stamp must not move, or
    // it would beat a newer edit of c1 made on another device.
    expect(stamps.challenges.c1).toBe(first)
    expect(Date.parse(stamps.challenges.c2)).toBeGreaterThan(Date.parse(first))
  })

  it('keeps a queued offline profile edit over the older remote profile', async () => {
    state.rows.profiles = [
      {
        id: 'uid-1',
        email: 'a@b.com',
        tz: 'UTC',
        late_night_buffer_hrs: 3,
        reminder_time: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]
    await repo.connectRemote('uid-1', 'a@b.com')
    state.failUpserts = true // offline: the edit stays queued
    repo.saveUser({ ...repo.getUser()!, tz: 'Asia/Tokyo', reminderTime: '20:00' })
    await repo.flush()

    await repo.connectRemote('uid-1', 'a@b.com') // e.g. a token refresh
    expect(repo.getUser()!.tz).toBe('Asia/Tokyo')
    expect(repo.getUser()!.reminderTime).toBe('20:00')
  })

  it('takes a remote profile that is newer than the queued edit', async () => {
    await repo.connectRemote('uid-1', 'a@b.com')
    state.failUpserts = true
    repo.saveUser({ ...repo.getUser()!, tz: 'Asia/Tokyo' })
    state.rows.profiles = [
      {
        id: 'uid-1',
        email: 'a@b.com',
        tz: 'Europe/Berlin',
        late_night_buffer_hrs: 2,
        reminder_time: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2099-01-01T00:00:00.000Z',
      },
    ]
    await repo.connectRemote('uid-1', 'a@b.com')
    expect(repo.getUser()!.tz).toBe('Europe/Berlin')
  })

  it('never carries one account\'s data or sync queue into another', async () => {
    await repo.connectRemote('uid-1', 'a@b.com')
    state.failUpserts = true // leave uid-1's work queued
    repo.saveChallenge(makeChallenge({ id: 'mine' }))
    state.failUpserts = false
    state.calls = []

    await repo.connectRemote('uid-2', 'b@b.com')
    expect(repo.getUser()!.id).toBe('uid-2')
    expect(repo.getChallenges()).toEqual([])
    const pushed = state.calls.filter((c) => c.op === 'upsert').map((c) => c.row?.id ?? c.row?.challenge_id)
    expect(pushed).not.toContain('mine')

    // Switching back restores uid-1's data and its queue, which then flushes.
    state.calls = []
    await repo.connectRemote('uid-1', 'a@b.com')
    expect(repo.getChallenges().map((c) => c.id)).toEqual(['mine'])
    const resumed = state.calls.filter((c) => c.op === 'upsert' && c.table === 'challenges')
    expect(resumed.map((c) => c.row?.id)).toContain('mine')
  })

  it('the first account to sign in adopts data made before signing in', async () => {
    local.saveUser({
      id: 'local-1',
      email: 'a@b.com',
      tz: 'UTC',
      lateNightBufferHrs: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      reminderTime: null,
    })
    repo.saveChallenge(makeChallenge({ id: 'before' }))
    await repo.connectRemote('uid-1', 'a@b.com')
    expect(repo.getUser()!.id).toBe('uid-1')
    expect(repo.getChallenges().map((c) => c.id)).toEqual(['before'])
  })
})


/** An instant rendered the way PostgREST renders timestamptz at `offsetHrs`. */
function plusOffset(epochMs: number, offsetHrs: number): string {
  const shifted = new Date(epochMs + offsetHrs * 3_600_000).toISOString()
  const sign = offsetHrs < 0 ? '-' : '+'
  const hh = String(Math.abs(offsetHrs)).padStart(2, '0')
  return shifted.replace(/\.(\d{3})Z$/, '.$1456') + `${sign}${hh}:00`
}
describe('SyncedRepository.pull', () => {
  it('is single-flight: callers during a pull wait for the same one', async () => {
    localStorage.clear()
    let hydrates = 0
    const state = { rows: {}, calls: [], failUpserts: false, serverNow: '2026-01-01T00:00:00Z' }
    const client = makeMockClient(state)
    const repo = new SyncedRepository(new LocalRepository(), client)
    await repo.connectRemote('uid-1', 'a@b.com')
    const original = (repo as unknown as { hydrate: (id: string) => Promise<void> }).hydrate.bind(repo)
    ;(repo as unknown as { hydrate: (id: string) => Promise<void> }).hydrate = async (id) => {
      hydrates++
      await new Promise((r) => setTimeout(r, 20))
      return original(id)
    }
    let firstDone = false
    const first = repo.pull().then(() => (firstDone = true))
    const second = repo.pull()
    await second
    expect(firstDone).toBe(true)
    await first
    expect(hydrates).toBe(1)
  })
})
