// The challenge session: everything that happens to a challenge over time, in
// one place. It owns the rules the UI must never re-derive — which day is
// today, when a day counts as complete, what a missed day costs, and how an
// attempt starts, resets, finishes and rolls into maintenance — and hands the
// UI a single Snapshot to render.
//
// Persistence and time are injected (a Repository and a clock), so the whole
// lifecycle is testable with LocalRepository and a fixed Date.

import { DayData, Repository, emptyDayData, newId } from './repository'
import {
  computeDayStates,
  currentDayIndex,
  missConsequence,
  streaks,
} from './challengeEngine'
import { creativeDate } from './creativeDay'
import {
  Challenge,
  Day,
  MAX_LOG_CHARS,
  MAX_RULES,
  MIN_RULES,
  Medium,
  MissPolicy,
  Rule,
  TOTAL_DAYS,
  User,
} from './types'

/**
 * Where the signed-in user stands.
 * - `signed-out`, `no-challenge`: nothing to render but a redirect.
 * - `prestart`: a challenge is set up but its start date hasn't arrived.
 * - `active`: today's check-in is open.
 * - `reset-pending`: a miss under Classic (or Grace with no tokens left) ended
 *   the attempt; nothing else happens until the user confirms the restart.
 * - `finished`: the last day is done (or the window has closed).
 * - `maintenance`: after Day 75, creating daily with no rules and no misses.
 */
export type Phase =
  | 'signed-out'
  | 'no-challenge'
  | 'prestart'
  | 'active'
  | 'reset-pending'
  | 'finished'
  | 'maintenance'

export interface Snapshot {
  phase: Phase
  user: User | null
  challenge: Challenge | null
  dayData: DayData
  days: Day[]
  /** 0 before the start date, then the 1-based creative day of the challenge. */
  currentIndex: number
  totalDays: number
  streak: { current: number; longest: number }
  completedCount: number
  /** Why the attempt ended, when `phase` is `reset-pending`. */
  resetMessage: string | null
  /** The creative date the snapshot was taken on; changes at day rollover. */
  creativeToday: string
}

/** A consequence applied during rollover, worth telling the user about once. */
export interface RolloverEvent {
  kind: 'skip' | 'extend'
  message: string
}

export interface ChallengeDraft {
  medium: Medium
  rules: Rule[]
  missPolicy: MissPolicy
  /** 'today' (the current creative day) or a future YYYY-MM-DD. */
  start: 'today' | string
  whyNote: string
}

export type ToggleResult =
  /** The check was saved. `justCompleted` is true when it finished the day. */
  | { ok: true; justCompleted: boolean }
  /** The day on screen is no longer today (or check-ins are closed). */
  | { ok: false }

export interface ChallengeSession {
  /** Apply any pending miss consequences, then read. Safe to call repeatedly. */
  sync(): { snapshot: Snapshot; events: RolloverEvent[] }
  /** Read without writing anything. */
  read(): Snapshot
  /** Toggle one of today's tasks. `dayIndex` is the day the user is looking at. */
  toggleTask(dayIndex: number, ruleId: string): ToggleResult
  /** Save the log for a day up to and including today. */
  saveLog(dayIndex: number, text: string): void
  /** Begin a new challenge. Throws if the draft is invalid or one is running. */
  start(draft: ChallengeDraft): Challenge
  /** Archive the ended attempt and restart at Day 1 today, same rules. */
  confirmReset(): void
  /** After finishing: keep creating daily with no rules. */
  enterMaintenance(): void
  /** After finishing (or from maintenance): close this challenge for a new one. */
  closeForNewRound(): void
}

export function createChallengeSession(
  repo: Repository,
  clock: () => Date = () => new Date(),
): ChallengeSession {
  function context() {
    const user = repo.isSignedIn() ? repo.getUser() : null
    const challenge = user ? repo.getActiveChallenge() : null
    return { user, challenge }
  }

  function snapshotOf(
    user: User | null,
    challenge: Challenge | null,
    now: Date,
  ): Snapshot {
    const creativeToday = user
      ? creativeDate(now, user.tz, user.lateNightBufferHrs)
      : ''
    const empty: Snapshot = {
      phase: user ? 'no-challenge' : 'signed-out',
      user,
      challenge: null,
      dayData: emptyDayData(),
      days: [],
      currentIndex: 0,
      totalDays: TOTAL_DAYS,
      streak: { current: 0, longest: 0 },
      completedCount: 0,
      resetMessage: null,
      creativeToday,
    }
    if (!user || !challenge) return empty

    const dayData = repo.getDayData(challenge.id)
    const days = statesOf(challenge, dayData, user, now)
    const currentIndex = currentDayIndex(challenge, now, user.tz, user.lateNightBufferHrs)
    const totalDays = days.length
    const pending = firstPendingMiss(days, dayData)
    const consequence = pending ? missConsequence(challenge) : null

    let phase: Phase
    if (challenge.status === 'maintenance') phase = 'maintenance'
    else if (consequence?.action === 'reset') phase = 'reset-pending'
    else if (currentIndex === 0) phase = 'prestart'
    else if (isFinished(days, currentIndex)) phase = 'finished'
    else phase = 'active'

    return {
      phase,
      user,
      challenge,
      dayData,
      days,
      currentIndex,
      totalDays,
      streak: streaks(days, currentIndex),
      completedCount: Object.keys(dayData.completions).length,
      resetMessage: phase === 'reset-pending' ? consequence!.message : null,
      creativeToday,
    }
  }

  function statesOf(challenge: Challenge, dayData: DayData, user: User, now: Date) {
    return computeDayStates(
      challenge,
      dayData.completions,
      now,
      user.tz,
      user.lateNightBufferHrs,
      dayData.skips,
    )
  }

  function read(): Snapshot {
    const { user, challenge } = context()
    return snapshotOf(user, challenge, clock())
  }

  function sync(): { snapshot: Snapshot; events: RolloverEvent[] } {
    const now = clock()
    const { user } = context()
    let { challenge } = context()
    const events: RolloverEvent[] = []

    if (user && challenge && challenge.status === 'active') {
      // Oldest miss first; each consequence can change what counts as missed
      // (an extension adds a day), so recompute after every step. Terminates:
      // each pass actions one miss, and the misses left can only shrink once
      // the grid has grown past today.
      for (;;) {
        const dayData = repo.getDayData(challenge.id)
        const miss = firstPendingMiss(statesOf(challenge, dayData, user, now), dayData)
        if (!miss) break
        const outcome = missConsequence(challenge)
        if (outcome.action === 'reset') break // waits for confirmReset()
        if (outcome.action === 'skip') repo.addSkip(challenge.id, miss.index)
        repo.addActionedMiss(challenge.id, miss.index)
        challenge = {
          ...challenge,
          skipTokensUsed: outcome.newSkipTokensUsed,
          extraDays: outcome.extraDays,
        }
        repo.saveChallenge(challenge)
        events.push({ kind: outcome.action, message: outcome.message })
      }
    }

    return { snapshot: snapshotOf(user, challenge, now), events: summarize(events) }
  }

  function toggleTask(dayIndex: number, ruleId: string): ToggleResult {
    const snap = read()
    const { challenge } = snap
    const open =
      challenge &&
      (snap.phase === 'active' || snap.phase === 'finished') &&
      dayIndex === snap.currentIndex &&
      dayIndex >= 1 &&
      dayIndex <= snap.totalDays
    const rule = challenge?.rules.find((r) => r.id === ruleId)
    if (!open || !challenge || !rule) return { ok: false }

    // Always decide from storage, never from what the UI last rendered, so a
    // double tap toggles back instead of setting the same value twice.
    const key = `${dayIndex}:${ruleId}`
    const checked = repo.getDayData(challenge.id).checks[key] === true
    repo.saveCheck(challenge.id, dayIndex, ruleId, !checked)

    const fresh = repo.getDayData(challenge.id)
    const complete = completionRules(challenge).every(
      (r) => fresh.checks[`${dayIndex}:${r.id}`] === true,
    )
    const wasComplete = Boolean(fresh.completions[dayIndex])
    if (complete && !wasComplete) {
      repo.saveDayCompletion(challenge.id, dayIndex, clock().toISOString())
      return { ok: true, justCompleted: true }
    }
    if (!complete && wasComplete) repo.saveDayCompletion(challenge.id, dayIndex, null)
    return { ok: true, justCompleted: false }
  }

  function saveLog(dayIndex: number, text: string): void {
    const snap = read()
    const { challenge } = snap
    if (!challenge || dayIndex < 1 || dayIndex > snap.currentIndex) return
    repo.saveLog(challenge.id, dayIndex, {
      dayId: `${challenge.id}:${dayIndex}`,
      text: text.slice(0, MAX_LOG_CHARS),
      updatedAt: clock().toISOString(),
    })
  }

  function start(draft: ChallengeDraft): Challenge {
    const { user, challenge: running } = context()
    if (!user) throw new Error('Sign in before starting a challenge.')
    if (running) throw new Error('A challenge is already running.')
    const problem = draftProblem(draft)
    if (problem) throw new Error(problem)

    const now = clock()
    const today = creativeDate(now, user.tz, user.lateNightBufferHrs)
    const startDate = draft.start === 'today' || draft.start < today ? today : draft.start
    const challenge: Challenge = {
      id: newId(),
      medium: draft.medium,
      rules: draft.rules.map((r) => ({ ...r, name: r.name.trim(), description: r.description.trim() })),
      missPolicy: draft.missPolicy,
      startDate,
      status: 'active',
      skipTokensUsed: 0,
      whyNote: draft.whyNote.trim(),
      createdAt: now.toISOString(),
      maintenanceMode: false,
      extraDays: 0,
    }
    repo.saveChallenge(challenge)
    return challenge
  }

  function confirmReset(): void {
    const snap = read()
    const { challenge, user } = snap
    if (snap.phase !== 'reset-pending' || !challenge || !user) return
    repo.saveChallenge({ ...challenge, status: 'archived' })
    repo.saveChallenge({
      ...challenge,
      id: newId(),
      status: 'active',
      startDate: snap.creativeToday,
      skipTokensUsed: 0,
      extraDays: 0,
      createdAt: clock().toISOString(),
    })
  }

  function enterMaintenance(): void {
    const snap = read()
    if (snap.phase !== 'finished' || !snap.challenge) return
    repo.saveChallenge({ ...snap.challenge, status: 'maintenance', maintenanceMode: true })
  }

  function closeForNewRound(): void {
    const snap = read()
    if ((snap.phase !== 'finished' && snap.phase !== 'maintenance') || !snap.challenge) return
    repo.saveChallenge({ ...snap.challenge, status: 'completed' })
  }

  return { sync, read, toggleTask, saveLog, start, confirmReset, enterMaintenance, closeForNewRound }
}

/**
 * The rules a day needs checked to count as complete: the required ones, or
 * every rule when none is marked required (an all-optional day must still be
 * earned; it can't complete itself on the first tap).
 */
export function completionRules(challenge: Challenge): Rule[] {
  const required = challenge.rules.filter((r) => r.required)
  return required.length > 0 ? required : challenge.rules
}

/** Why a draft can't start, or null when it can. */
export function draftProblem(draft: ChallengeDraft): string | null {
  const n = draft.rules.length
  if (n < MIN_RULES || n > MAX_RULES) return `Pick between ${MIN_RULES} and ${MAX_RULES} daily rules.`
  if (draft.rules.some((r) => r.name.trim().length === 0)) return 'Every rule needs a name.'
  if (!draft.rules.some((r) => r.required)) return 'Mark at least one rule as required.'
  return null
}

function firstPendingMiss(days: Day[], dayData: DayData): Day | undefined {
  return days.find((d) => d.state === 'missed' && !dayData.actionedMisses.includes(d.index))
}

function isFinished(days: Day[], currentIndex: number): boolean {
  const last = days[days.length - 1]
  return currentIndex > days.length || last?.state === 'complete'
}

/** One event per kind, so a long absence reads as one message, not twenty. */
function summarize(events: RolloverEvent[]): RolloverEvent[] {
  const out: RolloverEvent[] = []
  for (const kind of ['skip', 'extend'] as const) {
    const of = events.filter((e) => e.kind === kind)
    if (of.length === 1) out.push(of[0])
    else if (of.length > 1)
      out.push({
        kind,
        message:
          kind === 'skip'
            ? `${of.length} days were missed. ${of[of.length - 1].message.replace(/^A day was missed\. /, '')}`
            : `${of.length} days were missed. Extend mode added ${of.length} days to the end — your streak display resets but the challenge continues.`,
      })
  }
  return out
}
