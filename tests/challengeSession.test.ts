import { describe, it, expect, beforeEach } from 'bun:test'
import { LocalRepository } from '@/lib/localRepository'
import {
  ChallengeDraft,
  ChallengeSession,
  attemptDays,
  milestoneAt,
  createChallengeSession,
} from '@/lib/challengeSession'
import { DEFAULT_RULES, Rule, User } from '@/lib/types'

// The session is exercised through its interface only: a real LocalRepository
// (happy-dom localStorage) and a clock the test moves forward.

const USER: User = {
  id: 'u1',
  email: 'a@b.com',
  tz: 'UTC',
  lateNightBufferHrs: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  reminderTime: null,
}

const RULES: Rule[] = [
  { id: 'a', name: 'Make', description: '', required: true },
  { id: 'b', name: 'Study', description: '', required: true },
  { id: 'c', name: 'Walk', description: '', required: false },
]

function draft(over: Partial<ChallengeDraft> = {}): ChallengeDraft {
  return { medium: 'drawing', rules: RULES, missPolicy: 'classic', start: 'today', whyNote: '  to finish things  ', ...over }
}

let repo: LocalRepository
let now: Date
let session: ChallengeSession

/** Move the clock to noon UTC on a given day of January 2026. */
function at(day: number, hour = 12) {
  now = new Date(Date.UTC(2026, 0, day, hour))
}

function completeToday() {
  const { currentIndex } = session.read()
  session.toggleRule(currentIndex, 'a')
  session.toggleRule(currentIndex, 'b')
}

beforeEach(async () => {
  localStorage.clear()
  repo = new LocalRepository()
  await repo.deleteAllData()
  repo.saveUser(USER)
  repo.setSignedIn(true)
  at(1)
  session = createChallengeSession(repo, () => now)
})

describe('phases', () => {
  it('reports signed-out and no-challenge before anything exists', () => {
    expect(session.read().phase).toBe('no-challenge')
    repo.setSignedIn(false)
    expect(session.read().phase).toBe('signed-out')
  })

  it('starts today, trims text, and opens the check-in', () => {
    const c = session.start(draft())
    expect(c.startDate).toBe('2026-01-01')
    expect(c.whyNote).toBe('to finish things')
    const s = session.read()
    expect(s.phase).toBe('active')
    expect(s.currentIndex).toBe(1)
    expect(s.totalDays).toBe(75)
    expect(s.dayCloses).toBe('03:00')
    expect(s.stakes).toEqual({ policy: 'classic', tokensLeft: null, extraDays: 0 })
  })

  it('says the instant today closes, before and after midnight', () => {
    session.start(draft())
    // Noon on Day 1: it closes at 03:00 the next morning.
    expect(session.read().dayClosesAt).toBe('2026-01-02T03:00:00.000Z')
    // 02:50 on Jan 2 is still Day 1 under the 3h buffer: ten minutes left.
    at(2, 2)
    now = new Date(Date.UTC(2026, 0, 2, 2, 50, 30))
    expect(session.read().currentIndex).toBe(1)
    expect(session.read().dayClosesAt).toBe('2026-01-02T03:00:00.000Z')
  })

  it('is prestart until a future start date arrives', () => {
    session.start(draft({ start: '2026-01-05' }))
    expect(session.read().phase).toBe('prestart')
    at(5)
    expect(session.read().phase).toBe('active')
  })

  it('treats the small hours as the previous creative day when starting', () => {
    at(2, 1) // 01:00 on Jan 2 is still Jan 1 with a 3h buffer
    const c = session.start(draft())
    expect(c.startDate).toBe('2026-01-01')
    expect(session.read().currentIndex).toBe(1)
  })

  it('clamps a past start date to today', () => {
    expect(session.start(draft({ start: '2025-12-01' })).startDate).toBe('2026-01-01')
  })

  it('refuses invalid drafts and a second running challenge', () => {
    expect(() => session.start(draft({ rules: RULES.slice(0, 2) }))).toThrow(/between 3 and 7/)
    expect(() =>
      session.start(draft({ rules: RULES.map((r) => ({ ...r, required: false })) })),
    ).toThrow(/at least one rule/)
    expect(() => session.start(draft({ rules: [...RULES.slice(0, 2), { ...RULES[2], name: ' ' }] }))).toThrow(/needs a name/)
    session.start(draft())
    expect(() => session.start(draft())).toThrow(/already running/)
  })
})

describe('check-in', () => {
  beforeEach(() => {
    session.start(draft())
  })

  it('completes the day when every required rule is checked', () => {
    expect(session.toggleRule(1, 'a')).toEqual({ ok: true, justCompleted: false })
    expect(session.toggleRule(1, 'b')).toEqual({ ok: true, justCompleted: true })
    const s = session.read()
    expect(s.days[0].state).toBe('complete')
    expect(s.tally.made).toBe(1)
    expect(s.streak.current).toBe(1)
  })

  it('optional rules do not gate completion, and unchecking reopens the day', () => {
    completeToday()
    expect(session.toggleRule(1, 'b')).toEqual({ ok: true, justCompleted: false, reopened: true })
    expect(session.read().days[0].state).toBe('today')
    expect(session.read().tally.made).toBe(0)
  })

  it('toggles from storage, so a double tap toggles back', () => {
    session.toggleRule(1, 'a')
    session.toggleRule(1, 'a')
    expect(session.read().dayData.checks['1:a']).toBe(false)
  })

  it('refuses to toggle a day that is no longer today', () => {
    at(2)
    expect(session.toggleRule(1, 'a')).toEqual({ ok: false })
    expect(session.toggleRule(99, 'a')).toEqual({ ok: false })
    expect(session.toggleRule(2, 'nope')).toEqual({ ok: false })
  })

  it('saves logs for past and current days, clipped, but never the future', () => {
    session.saveLog(1, 'x'.repeat(600))
    session.saveLog(3, 'future')
    const logs = session.read().dayData.logs
    expect(logs[1].text.length).toBe(500)
    expect(logs[3]).toBeUndefined()
  })
})

describe('evidence rules', () => {
  const EVIDENCE: Rule[] = [
    { id: 'make', name: 'Make', description: '', required: true },
    { id: 'words', name: 'Write it down', description: '', required: true, evidence: 'log' },
    { id: 'proof', name: 'Keep a piece', description: '', required: true, evidence: 'artifact' },
  ]
  beforeEach(() => {
    session.start(draft({ rules: EVIDENCE }))
  })

  it('cannot be ticked by hand', () => {
    expect(session.toggleRule(1, 'words')).toEqual({ ok: false })
    expect(session.toggleRule(1, 'proof')).toEqual({ ok: false })
  })

  it('are met by the evidence, and the last piece completes the day', async () => {
    expect(session.toggleRule(1, 'make')).toEqual({ ok: true, justCompleted: false })
    expect(session.saveLog(1, '   ')).toEqual({ ok: true, justCompleted: false })
    expect(session.saveLog(1, 'Two thumbnails.')).toEqual({ ok: true, justCompleted: false })
    expect(session.attachLink(1, 'https://example.com/a')).toEqual({ ok: true, justCompleted: true })
    expect(session.read().days[0].state).toBe('complete')
  })

  it('removing the only artifact reopens the day', async () => {
    session.toggleRule(1, 'make')
    session.saveLog(1, 'x')
    await session.attachImage(1, new Blob([new Uint8Array([1])], { type: 'image/png' }))
    expect(session.read().days[0].state).toBe('complete')
    const [artifact] = session.read().dayData.artifacts[1]
    expect(session.wouldReopen(1, artifact.id)).toBe(true)
    expect(await session.removeArtifact(1, artifact.id)).toEqual({
      ok: true,
      justCompleted: false,
      reopened: true,
    })
    expect(session.read().days[0].state).toBe('today')
    expect(await repo.getArtifactBlob(artifact.blobRef!)).toBeNull()
  })

  it('refuses artifacts for a day that is no longer today', async () => {
    at(2)
    expect(session.attachLink(1, 'https://example.com')).toEqual({ ok: false })
    expect(await session.attachImage(1, new Blob(['x']))).toEqual({ ok: false })
  })

  it('recognises the untouched default rules on challenges started before evidence existed', () => {
    const c = session.read().challenge!
    repo.saveChallenge({
      ...c,
      rules: DEFAULT_RULES.map(({ evidence: _e, ...r }) => r),
    })
    for (const id of ['create', 'study', 'no-passive']) session.toggleRule(1, id)
    expect(session.toggleRule(1, 'log')).toEqual({ ok: false })
    session.saveLog(1, 'did it')
    expect(session.attachLink(1, 'https://example.com')).toEqual({ ok: true, justCompleted: true })
  })
})

describe('an all-optional challenge (legacy data)', () => {
  it('needs every rule checked, so one tap cannot complete the day', () => {
    // draftProblem forbids this now, but older stored challenges may have it.
    const c = session.start(draft())
    repo.saveChallenge({ ...c, rules: c.rules.map((r) => ({ ...r, required: false })) })
    expect(session.toggleRule(1, 'a')).toEqual({ ok: true, justCompleted: false })
    session.toggleRule(1, 'b')
    expect(session.toggleRule(1, 'c')).toEqual({ ok: true, justCompleted: true })
  })
})

describe('rollover and miss policies', () => {
  it('classic: a miss ends the attempt and waits for confirmation', () => {
    session.start(draft())
    completeToday()
    at(3) // day 2 missed
    const { snapshot, events } = session.sync()
    expect(snapshot.phase).toBe('reset-pending')
    expect(snapshot.missedDay).toBe(2)
    expect(snapshot.resetMessage).toBe(
      'Day 2 was missed. Under Classic, that ends this attempt. Restarting keeps your 3 rules and makes today Day 1.',
    )
    expect(events).toEqual([])
    // Pending is state, not a one-shot banner: it survives every re-read...
    expect(session.sync().snapshot.phase).toBe('reset-pending')
    // ...and blocks check-ins until confirmed.
    expect(session.toggleRule(3, 'a')).toEqual({ ok: false })

    session.confirmReset()
    const after = session.read()
    expect(after.phase).toBe('active')
    expect(after.currentIndex).toBe(1)
    expect(after.challenge!.startDate).toBe('2026-01-03')
    const [archived] = repo.getChallenges().filter((c) => c.status === 'archived')
    expect(archived.endedOnDay).toBe(2)
    const grid = attemptDays(archived, repo.getDayData(archived.id))
    expect(grid.slice(0, 3).map((d) => d.state)).toEqual(['complete', 'missed', 'future'])
  })

  it('confirmReset does nothing unless a reset is pending', () => {
    session.start(draft())
    session.confirmReset()
    expect(repo.getChallenges()).toHaveLength(1)
  })

  it('grace: each miss spends a token once, then the next miss resets', () => {
    session.start(draft({ missPolicy: 'grace' }))
    at(2) // day 1 missed
    const first = session.sync()
    expect(first.events).toEqual([
      {
        kind: 'skip',
        days: [1],
        message: 'Day 1 was missed. A skip token covered it, so your streak is intact — 2 of 3 left.',
      },
    ])
    expect(first.snapshot.days[0].state).toBe('skipped')
    expect(first.snapshot.stakes).toEqual({ policy: 'grace', tokensLeft: 2, extraDays: 0 })
    // Idempotent: syncing again spends nothing.
    expect(session.sync().events).toEqual([])
    expect(session.read().stakes!.tokensLeft).toBe(2)

    at(4) // days 2 and 3 missed: tokens 2 and 3
    const second = session.sync()
    expect(second.events).toHaveLength(1)
    expect(second.events[0].message).toBe(
      'Days 2–3 were missed. Skip tokens covered them, so your streak is intact — 0 of 3 left. No skips left: the next miss ends this attempt.',
    )
    expect(second.snapshot.stakes!.tokensLeft).toBe(0)
    expect(second.snapshot.phase).toBe('active')

    at(5) // day 4 missed with no tokens left
    const ended = session.sync().snapshot
    expect(ended.phase).toBe('reset-pending')
    expect(ended.missedDay).toBe(4)
    expect(ended.resetMessage).toBe(
      'Day 4 was missed with no skip tokens left, so this attempt ends here. Restarting keeps your 3 rules and makes today Day 1.',
    )
  })

  it('a skip token protects the streak', () => {
    session.start(draft({ missPolicy: 'grace' }))
    completeToday()
    at(2)
    completeToday()
    at(4) // day 3 missed, covered
    session.sync()
    completeToday()
    expect(session.read().streak).toEqual({ current: 3, longest: 3 })
  })

  it('extend: each miss adds a day and the challenge continues', () => {
    session.start(draft({ missPolicy: 'extend' }))
    completeToday()
    at(4) // days 2, 3 missed
    const { snapshot, events } = session.sync()
    expect(snapshot.totalDays).toBe(77)
    expect(snapshot.phase).toBe('active')
    expect(events).toHaveLength(1)
    expect(events[0].message).toBe(
      'Days 2–3 were missed. Extend adds them to the end: the challenge now runs 77 days.',
    )
    expect(snapshot.stakes).toEqual({ policy: 'extend', tokensLeft: null, extraDays: 2 })
  })

  it('extend after a long absence leaves exactly the unfinished days ahead', () => {
    session.start(draft({ missPolicy: 'extend' }))
    completeToday()
    at(31 + 29) // Mar 1: day 60, 58 days missed
    const s = session.sync().snapshot
    expect(s.currentIndex).toBe(60)
    expect(s.totalDays - s.currentIndex + 1).toBe(74) // 75 - 1 completed
  })
})

describe('finishing, maintenance, new round', () => {
  function finishAll() {
    session.start(draft({ missPolicy: 'extend' }))
    for (let d = 1; d <= 75; d++) {
      now = new Date(Date.UTC(2026, 0, d, 12))
      completeToday()
    }
  }

  it('finishes on day 75 and enters maintenance', () => {
    finishAll()
    expect(session.read().phase).toBe('finished')
    session.enterMaintenance()
    now = new Date(Date.UTC(2026, 0, 80, 12))
    const s = session.sync().snapshot
    expect(s.phase).toBe('maintenance')
    expect(s.currentIndex).toBe(80)
    // Maintenance keeps a daily log with no rules and no misses.
    session.saveLog(80, 'still going')
    expect(session.read().dayData.logs[80].text).toBe('still going')
    expect(session.toggleRule(80, 'a')).toEqual({ ok: false })
  })

  it('closes the finished challenge so a new round can start', () => {
    finishAll()
    session.closeForNewRound()
    expect(session.read().phase).toBe('no-challenge')
    expect(() => session.start(draft())).not.toThrow()
  })

  it('will not enter maintenance or close a challenge that is still running', () => {
    session.start(draft())
    session.enterMaintenance()
    session.closeForNewRound()
    expect(session.read().phase).toBe('active')
  })
})

it('the default rule set is a valid draft', () => {
  expect(() => session.start(draft({ rules: DEFAULT_RULES }))).not.toThrow()
})

/** Complete every day from the current one up to `last`, skipping `except`. */
function runTo(last: number, except: number[] = []) {
  for (let d = session.read().currentIndex; d <= last; d++) {
    at(d)
    session.sync()
    if (!except.includes(d)) completeToday()
  }
}

describe('outcome', () => {
  it('counts made, skipped and missed days once, for every caller', () => {
    session.start(draft({ missPolicy: 'grace' }))
    completeToday()
    session.saveLog(1, 'first')
    session.attachLink(1, 'https://example.com')
    at(3)
    session.sync()
    expect(session.read().tally).toEqual({ made: 1, skipped: 1, missed: 0, logsWritten: 1, artifactsKept: 1 })
  })

  it('finishes a Grace run with skips, and says so in the tally', () => {
    session.start(draft({ missPolicy: 'grace' }))
    runTo(75, [10, 20])
    const s = session.sync().snapshot
    expect(s.phase).toBe('finished')
    expect(s.tally).toMatchObject({ made: 73, skipped: 2, missed: 0 })
  })

  it('an Extend run is not finished at Day 75 when days were added', () => {
    session.start(draft({ missPolicy: 'extend' }))
    runTo(75, [10])
    let s = session.sync().snapshot
    expect(s.totalDays).toBe(76)
    expect(s.phase).toBe('active')
    at(76)
    s = session.sync().snapshot
    completeToday()
    s = session.read()
    expect(s.phase).toBe('finished')
    expect(s.tally).toMatchObject({ made: 75, missed: 1 })
  })

  it('places milestones against the real length', () => {
    expect(milestoneAt(7, 75)).toBe('week')
    expect(milestoneAt(50, 77)).toBe('two-thirds')
    expect(milestoneAt(75, 75)).toBe('final')
    expect(milestoneAt(75, 77)).toBeNull()
    expect(milestoneAt(77, 77)).toBe('final')
    expect(milestoneAt(12, 75)).toBeNull()
  })

  it('draws no today and closes the check-in once an attempt has ended', () => {
    session.start(draft())
    at(3)
    const s = session.sync().snapshot
    expect(s.phase).toBe('reset-pending')
    expect(s.checkInOpen).toBe(false)
    expect(s.days.some((d) => d.state === 'today')).toBe(false)
  })
})

describe('maintenance', () => {
  it('keeps artifacts on a maintenance day without completing anything', async () => {
    session.start(draft())
    runTo(75)
    session.enterMaintenance()
    at(80)
    const s = session.sync().snapshot
    expect(s.phase).toBe('maintenance')
    expect(session.attachLink(s.currentIndex, 'https://example.com')).toEqual({ ok: true, justCompleted: false })
    const dd = session.read().dayData
    expect(dd.artifacts[s.currentIndex]).toHaveLength(1)
    expect(dd.completions[s.currentIndex]).toBeUndefined()
    const id = dd.artifacts[s.currentIndex][0].id
    expect((await session.removeArtifact(s.currentIndex, id)).ok).toBe(true)
    expect(session.toggleRule(s.currentIndex, 'a')).toEqual({ ok: false })
  })
})

describe('day boundary', () => {
  beforeEach(() => {
    session.start(draft())
    runTo(1)
    at(3, 1) // 01:00 on Jan 3: still Day 2 under the 3h buffer
    session.sync()
  })

  it('refuses a change that would close today before it is made', () => {
    expect(session.read().currentIndex).toBe(2)
    const r = session.changeDayBoundary({ lateNightBufferHrs: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/Day 2 isn’t made yet/)
    expect(session.sync().snapshot.phase).toBe('active')
    expect(repo.getUser()!.lateNightBufferHrs).toBe(3)
  })

  it('allows it once today is made', () => {
    completeToday()
    expect(session.changeDayBoundary({ lateNightBufferHrs: 0 })).toEqual({ ok: true })
    const s = session.sync().snapshot
    expect(s.currentIndex).toBe(3)
    expect(s.phase).toBe('active')
  })

  it('refuses a change that would reopen a day that has closed', () => {
    at(3, 4) // 04:00 on Jan 3: Day 3 under the 3h buffer
    session.sync()
    completeToday()
    const r = session.changeDayBoundary({ lateNightBufferHrs: 6 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/already closed.*after 6:00 am/)
  })

  it('applies a change that keeps the same creative day', () => {
    expect(session.changeDayBoundary({ lateNightBufferHrs: 4 })).toEqual({ ok: true })
    expect(session.read().dayCloses).toBe('04:00')
  })

  it('sets the reminder through the session', () => {
    session.setReminder('20:30')
    expect(repo.getUser()!.reminderTime).toBe('20:30')
    session.setReminder(null)
    expect(repo.getUser()!.reminderTime).toBeNull()
  })
})

describe('reconcile after sync', () => {
  it('gives back a skip token when another device made the day', () => {
    session.start(draft({ missPolicy: 'grace' }))
    completeToday()
    at(3)
    session.sync() // Day 2 missed here: a token is spent
    const c = repo.getActiveChallenge()!
    expect(c.skipTokensUsed).toBe(1)
    // ...but Day 2 was made on the laptop, and the merge brings it in.
    repo.saveDayCompletion(c.id, 2, '2026-01-02T20:00:00.000Z')
    const { snapshot, events } = session.sync()
    expect(repo.getActiveChallenge()!.skipTokensUsed).toBe(0)
    expect(snapshot.dayData.skips).toEqual([])
    expect(snapshot.days[1].state).toBe('complete')
    expect(events[0]).toMatchObject({ kind: 'restore', days: [2] })
    expect(events[0].message).toMatch(/Day 2 was made on another device, so its skip token is back/)
  })

  it('says so when the merge itself dropped the miss (a real pull)', () => {
    session.start(draft({ missPolicy: 'grace' }))
    completeToday()
    at(3)
    session.sync() // Day 2 missed here: a token is spent
    const c = repo.getActiveChallenge()!
    // The laptop's copy made Day 2; a pull merges it in, and the merge drops
    // the stale skip before the session sees it.
    const remote = { ...repo.getDayData(c.id), skips: [], actionedMisses: [] }
    remote.completions = { ...remote.completions, 2: '2026-01-02T20:00:00.000Z' }
    repo.mergeRemoteDayData(c.id, remote)
    expect(repo.getDayData(c.id).skips).toEqual([])
    const { events, notice } = session.sync()
    expect(repo.getActiveChallenge()!.skipTokensUsed).toBe(0)
    expect(events).toEqual([expect.objectContaining({ kind: 'restore', days: [2] })])
    expect(notice?.message).toMatch(/Day 2 was made on another device, so its skip token is back/)
    // Told once: the next sync has nothing to say.
    expect(session.sync().notice).toBeNull()
  })

  it('still tells a fresh session (a reload), with the day', () => {
    session.start(draft({ missPolicy: 'extend' }))
    completeToday()
    at(3)
    session.sync()
    const c = repo.getActiveChallenge()!
    const remote = { ...repo.getDayData(c.id), skips: [], actionedMisses: [] }
    remote.completions = { ...remote.completions, 2: '2026-01-02T20:00:00.000Z' }
    repo.mergeRemoteDayData(c.id, remote)
    // A reload: the session that saw Day 2 missed is gone.
    const fresh = createChallengeSession(repo, () => now)
    const { snapshot, notice } = fresh.sync()
    expect(snapshot.totalDays).toBe(75)
    expect(notice).toMatchObject({ kind: 'restore', days: [2] })
    expect(notice!.message).toMatch(/Day 2 was made on another device, so the challenge is shorter again/)
  })

  it('tells the device that made the day nothing, when the other device’s count arrives', () => {
    session.start(draft({ missPolicy: 'grace' }))
    completeToday()
    at(2)
    completeToday() // Day 2 made here
    at(3)
    session.sync()
    const c = repo.getActiveChallenge()!
    // The phone missed Day 2 and its newer challenge row (a token spent)
    // arrives, with its day data carrying the stale skip.
    repo.saveChallenge({ ...c, skipTokensUsed: 1 })
    const remote = { ...repo.getDayData(c.id), skips: [2], actionedMisses: [2] }
    repo.mergeRemoteDayData(c.id, remote)
    const { notice } = session.sync()
    expect(repo.getActiveChallenge()!.skipTokensUsed).toBe(0)
    expect(notice).toBeNull()
  })

  it('shortens an Extend challenge again when the missed day was made', () => {
    session.start(draft({ missPolicy: 'extend' }))
    completeToday()
    at(3)
    expect(session.sync().snapshot.totalDays).toBe(76)
    repo.saveDayCompletion(repo.getActiveChallenge()!.id, 2, '2026-01-02T20:00:00.000Z')
    expect(session.sync().snapshot.totalDays).toBe(75)
  })

  it('lifts a pending Classic reset when the day turns out to be made', () => {
    session.start(draft())
    completeToday()
    at(3)
    expect(session.sync().snapshot.phase).toBe('reset-pending')
    repo.saveDayCompletion(repo.getActiveChallenge()!.id, 2, '2026-01-02T20:00:00.000Z')
    expect(session.sync().snapshot.phase).toBe('active')
  })
})

describe('ending and history', () => {
  it('ends an attempt at the person’s request and keeps it in history', () => {
    session.start(draft())
    completeToday()
    at(2)
    session.sync()
    session.endAttempt()
    expect(session.read().phase).toBe('no-challenge')
    const [past] = session.history()
    expect(past).toMatchObject({ outcome: 'ended', endedOn: 2 })
    expect(past.tally.made).toBe(1)
    // Day 2 was quit, not missed.
    expect(past.tally.missed).toBe(0)
    expect(past.days[1].state).toBe('future')
  })

  it('says what ending would do, and a reset still draws its miss', () => {
    session.start(draft())
    expect(session.read().ending).toEqual({ kind: 'stop', day: 1 })
    completeToday()
    at(3)
    const s = session.sync().snapshot
    expect(s.ending).toEqual({ kind: 'stop', day: 2 })
    session.confirmReset()
    const [past] = session.history()
    expect(past.days[1].state).toBe('missed')
  })

  it('ending while a miss is pending keeps the miss in history', () => {
    session.start(draft())
    completeToday()
    at(3)
    expect(session.sync().snapshot.phase).toBe('reset-pending')
    session.endAttempt()
    const [past] = session.history()
    expect(past.endedOn).toBe(2)
    expect(past.days[1].state).toBe('missed')
    expect(past.tally.missed).toBe(1)
  })

  it('lets a future start be set up again, out of history', () => {
    session.start(draft({ start: '2026-01-10' }))
    expect(session.read().ending).toEqual({ kind: 'redo' })
    session.endAttempt()
    expect(session.read().phase).toBe('no-challenge')
    expect(session.history()).toEqual([])
  })

  it('keeps a finished round in history after a new round starts', () => {
    session.start(draft())
    runTo(75)
    session.closeForNewRound()
    session.start(draft({ missPolicy: 'grace' }))
    const [round] = session.history()
    expect(round.outcome).toBe('finished')
    expect(round.endedOn).toBeNull()
    expect(round.tally.made).toBe(75)
  })
})

describe('one notice per sync', () => {
  it('says both a restore and a newly spent token', () => {
    session.start(draft({ missPolicy: 'grace' }))
    completeToday()
    at(3)
    session.sync() // Day 2 spends a token
    const id = repo.getActiveChallenge()!.id
    // The laptop made Days 2 and 3; Day 4 goes unmade.
    repo.saveDayCompletion(id, 2, '2026-01-02T20:00:00.000Z')
    repo.saveDayCompletion(id, 3, '2026-01-03T20:00:00.000Z')
    at(5)
    const { notice } = session.sync()
    expect(notice?.kind).toBe('skip')
    expect(notice?.message).toMatch(/Day 2 was made on another device/)
    expect(notice?.message).toMatch(/Day 4 was missed/)
    expect(repo.getActiveChallenge()!.skipTokensUsed).toBe(1)
  })
  it('keeps the notice until it is dismissed, across a reload', () => {
    session.start(draft({ missPolicy: 'grace' }))
    completeToday()
    at(3)
    expect(session.sync().notice?.kind).toBe('skip')
    // A reload: a new session, and a sync with nothing new to say.
    const again = createChallengeSession(repo, () => now)
    expect(again.sync().notice).toBeNull()
    expect(again.read().notice?.message).toMatch(/Day 2 was missed/)
    again.dismissNotice()
    expect(createChallengeSession(repo, () => now).read().notice).toBeNull()
  })

  it('keeps a notice with its own account', () => {
    session.start(draft({ missPolicy: 'grace' }))
    completeToday()
    at(3)
    session.sync()
    repo.switchUser({ ...USER, id: 'u2', email: 'c@d.com' })
    repo.setSignedIn(true)
    expect(session.read().notice).toBeNull()
    repo.switchUser(USER)
    repo.setSignedIn(true)
    expect(session.read().notice?.kind).toBe('skip')
    // Signed out, nothing shows.
    repo.setSignedIn(false)
    expect(session.read().notice).toBeNull()
  })

  it('drops the notice when the attempt it was about ends', () => {
    session.start(draft({ missPolicy: 'grace' }))
    completeToday()
    at(3)
    session.sync()
    session.endAttempt()
    expect(session.read().notice).toBeNull()
  })

  it('never shows a notice on an attempt it wasn’t about', () => {
    session.start(draft({ missPolicy: 'grace' }))
    completeToday()
    at(3)
    session.sync() // "Day 2 was missed…"
    // The attempt is archived elsewhere (another device, or a new round) and
    // a fresh one starts here.
    const old = repo.getActiveChallenge()!
    repo.saveChallenge({ ...old, status: 'archived', endedOnDay: 3, endedBy: 'person' })
    session.start(draft({ missPolicy: 'grace' }))
    expect(session.sync().snapshot.notice).toBeNull()
  })
})
