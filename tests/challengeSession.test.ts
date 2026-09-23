import { describe, it, expect, beforeEach } from 'bun:test'
import { LocalRepository } from '@/lib/localRepository'
import {
  ChallengeDraft,
  ChallengeSession,
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
  session.toggleTask(currentIndex, 'a')
  session.toggleTask(currentIndex, 'b')
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
    expect(session.toggleTask(1, 'a')).toEqual({ ok: true, justCompleted: false })
    expect(session.toggleTask(1, 'b')).toEqual({ ok: true, justCompleted: true })
    const s = session.read()
    expect(s.days[0].state).toBe('complete')
    expect(s.completedCount).toBe(1)
    expect(s.streak.current).toBe(1)
  })

  it('optional rules do not gate completion, and unchecking reopens the day', () => {
    completeToday()
    session.toggleTask(1, 'b')
    expect(session.read().days[0].state).toBe('today')
    expect(session.read().completedCount).toBe(0)
  })

  it('toggles from storage, so a double tap toggles back', () => {
    session.toggleTask(1, 'a')
    session.toggleTask(1, 'a')
    expect(session.read().dayData.checks['1:a']).toBe(false)
  })

  it('refuses to toggle a day that is no longer today', () => {
    at(2)
    expect(session.toggleTask(1, 'a')).toEqual({ ok: false })
    expect(session.toggleTask(99, 'a')).toEqual({ ok: false })
    expect(session.toggleTask(2, 'nope')).toEqual({ ok: false })
  })

  it('saves logs for past and current days, clipped, but never the future', () => {
    session.saveLog(1, 'x'.repeat(600))
    session.saveLog(3, 'future')
    const logs = session.read().dayData.logs
    expect(logs[1].text.length).toBe(500)
    expect(logs[3]).toBeUndefined()
  })
})

describe('an all-optional challenge (legacy data)', () => {
  it('needs every rule checked, so one tap cannot complete the day', () => {
    // draftProblem forbids this now, but older stored challenges may have it.
    const c = session.start(draft())
    repo.saveChallenge({ ...c, rules: c.rules.map((r) => ({ ...r, required: false })) })
    expect(session.toggleTask(1, 'a')).toEqual({ ok: true, justCompleted: false })
    session.toggleTask(1, 'b')
    expect(session.toggleTask(1, 'c')).toEqual({ ok: true, justCompleted: true })
  })
})

describe('rollover and miss policies', () => {
  it('classic: a miss ends the attempt and waits for confirmation', () => {
    session.start(draft())
    completeToday()
    at(3) // day 2 missed
    const { snapshot, events } = session.sync()
    expect(snapshot.phase).toBe('reset-pending')
    expect(snapshot.resetMessage).toMatch(/Day 1/)
    expect(events).toEqual([])
    // Pending is state, not a one-shot banner: it survives every re-read...
    expect(session.sync().snapshot.phase).toBe('reset-pending')
    // ...and blocks check-ins until confirmed.
    expect(session.toggleTask(3, 'a')).toEqual({ ok: false })

    session.confirmReset()
    const after = session.read()
    expect(after.phase).toBe('active')
    expect(after.currentIndex).toBe(1)
    expect(after.challenge!.startDate).toBe('2026-01-03')
    expect(repo.getChallenges().filter((c) => c.status === 'archived')).toHaveLength(1)
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
    expect(first.events).toEqual([{ kind: 'skip', message: expect.stringContaining('1 of 3') }])
    expect(first.snapshot.days[0].state).toBe('skipped')
    expect(first.snapshot.challenge!.skipTokensUsed).toBe(1)
    // Idempotent: syncing again spends nothing.
    expect(session.sync().events).toEqual([])
    expect(session.read().challenge!.skipTokensUsed).toBe(1)

    at(4) // days 2 and 3 missed: tokens 2 and 3
    const second = session.sync()
    expect(second.events).toHaveLength(1)
    expect(second.events[0].message).toMatch(/^2 days were missed/)
    expect(second.snapshot.challenge!.skipTokensUsed).toBe(3)
    expect(second.snapshot.phase).toBe('active')

    at(5) // day 4 missed with no tokens left
    expect(session.sync().snapshot.phase).toBe('reset-pending')
  })

  it('extend: each miss adds a day and the challenge continues', () => {
    session.start(draft({ missPolicy: 'extend' }))
    completeToday()
    at(4) // days 2, 3 missed
    const { snapshot, events } = session.sync()
    expect(snapshot.totalDays).toBe(77)
    expect(snapshot.phase).toBe('active')
    expect(events).toHaveLength(1)
    expect(events[0].message).toMatch(/added 2 days/)
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
    expect(session.toggleTask(80, 'a')).toEqual({ ok: false })
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
