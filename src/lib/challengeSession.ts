// The challenge session: everything that happens to a challenge over time, in
// one place. It owns the rules the UI must never re-derive — which day is
// today, when a day counts as complete, what a missed day costs, and how an
// attempt starts, resets, finishes and rolls into maintenance — and hands the
// UI a single Snapshot to render.
//
// Persistence and time are injected (a Repository and a clock), so the whole
// lifecycle is testable with LocalRepository and a fixed Date.

import { DayData, Repository, checkKey, dayId, emptyDayData, newId } from './repository'
import {
  challengeLength,
  computeDayStates,
  currentDayIndex,
  missConsequence,
  streaks,
} from './challengeEngine'
import { creativeDate, daysBetween, localDate, localTime } from './creativeDay'
import { clockTime, longDay } from './format'
import {
  Artifact,
  Challenge,
  Day,
  Evidence,
  MAX_LOG_CHARS,
  MAX_RULES,
  MAX_SKIP_TOKENS,
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
 * - `finished`: the last day is done, or has passed with every miss covered.
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
  /** What the challenge adds up to so far. */
  tally: Tally
  /** Whether today's challenge day takes check-ins (ticks, logs, artifacts). */
  checkInOpen: boolean
  /** Why the attempt ended, when `phase` is `reset-pending`. */
  resetMessage: string | null
  /** The missed day that ended the attempt, when `phase` is `reset-pending`. */
  missedDay: number | null
  /** The creative date the snapshot was taken on; changes at day rollover. */
  creativeToday: string
  /** Local wall-clock time ("HH:MM") at which today's creative day closes. */
  dayCloses: string
  /** The instant (ISO) today's creative day closes, for a countdown. '' when signed out. */
  dayClosesAt: string
  /** What a miss costs, so the dashboard can keep the stakes visible. */
  stakes: Stakes | null
  /**
   * What ending the challenge now would do (Settings shows it; endAttempt
   * does it): a free redo before Day 1, stopping on a given day, or null
   * when there's nothing to end (finished rounds close with a new round).
   */
  ending: Ending | null
  /**
   * The notice not yet dismissed, for this attempt only (kept across
   * reloads, per account): the only place a person learns a token was spent
   * while they were away. Null when signed out or when it was about an
   * attempt that has since ended.
   */
  notice: RolloverEvent | null
}

export type Ending = { kind: 'redo' } | { kind: 'stop'; day: number }

export interface Stakes {
  policy: MissPolicy
  /** Grace only: skip tokens still unspent. */
  tokensLeft: number | null
  /** Extend only: days added to the end so far. */
  extraDays: number
}

/**
 * The counts every summary shows (header, recap, certificate, past attempts),
 * counted once, over the challenge's own days.
 */
export interface Tally {
  made: number
  /** Covered by a Grace skip token. */
  skipped: number
  /** Days drawn as missed (under Extend, each one added a day to the end). */
  missed: number
  /** Challenge days with a written log. */
  logsWritten: number
  /** Images and links kept on challenge days. */
  artifactsKept: number
}

/** The days worth marking on the way through, measured against the real length. */
export type Milestone = 'week' | 'third' | 'two-thirds' | 'final'

/** A change to when the creative day rolls over. */
export interface DayBoundary {
  tz?: string
  lateNightBufferHrs?: number
}

export type BoundaryResult = { ok: true } | { ok: false; reason: string }

/** A consequence applied during rollover, worth telling the user about once. */
export interface RolloverEvent {
  /** `restore`: a day actioned as missed turned out to be made (another
   *  device synced it in), so its token or extension was given back. */
  kind: 'skip' | 'extend' | 'restore'
  message: string
  /** The missed days this consequence covered. */
  days: number[]
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
  /** The write was saved. `justCompleted` is true when it finished the day;
   *  `reopened` is set when it took a completed day back off the grid. */
  | { ok: true; justCompleted: boolean; reopened?: true }
  /** The day on screen is no longer today, check-ins are closed, or the rule
   *  is met by evidence rather than a tick. */
  | { ok: false }

export interface ChallengeSession {
  /**
   * Apply any pending miss consequences, then read. Safe to call repeatedly.
   * `notice` is what to tell the person about this sync, all of it in one
   * message (a restore and a newly spent token together, say), or null.
   */
  sync(): { snapshot: Snapshot; events: RolloverEvent[]; notice: RolloverEvent | null }
  /** The person has read the snapshot's notice. */
  dismissNotice(): void
  /** Read without writing anything. */
  read(): Snapshot
  /** Tick or untick one of today's rules. `dayIndex` is the day the user is looking at. */
  toggleRule(dayIndex: number, ruleId: string): ToggleResult
  /** Save the log for a day up to and including today. */
  saveLog(dayIndex: number, text: string): ToggleResult
  /** Attach an image (already compressed) to today. */
  attachImage(dayIndex: number, blob: Blob): Promise<ToggleResult>
  /** Attach a web link to today. The URL must already be validated. */
  attachLink(dayIndex: number, url: string): ToggleResult
  /** Remove one of today's artifacts (and its stored image). */
  removeArtifact(dayIndex: number, artifactId: string): Promise<ToggleResult>
  /**
   * Move the day boundary (time zone or late-night buffer). Refused, with the
   * reason, when it would close today before it's made or reopen a day that
   * has already closed: a setting must never decide a day.
   */
  changeDayBoundary(change: DayBoundary): BoundaryResult
  /** Set or clear the daily reminder time ("HH:MM"). */
  setReminder(time: string | null): void
  /** Whether removing that artifact would reopen a completed today. */
  wouldReopen(dayIndex: number, artifactId: string): boolean
  /** Begin a new challenge. Throws if the draft is invalid or one is running. */
  start(draft: ChallengeDraft): Challenge
  /** Archive the ended attempt and restart at Day 1 today, same rules. */
  confirmReset(): void
  /** After finishing: keep creating daily with no rules. */
  enterMaintenance(): void
  /** After finishing (or from maintenance): close this challenge for a new one. */
  closeForNewRound(): void
  /**
   * Stop the running challenge at the person's own request: before Day 1 (to
   * change the setup), mid-attempt, or instead of restarting after a miss.
   * The attempt is archived with everything made; nothing is deleted.
   */
  endAttempt(): void
  /** Every past attempt and finished round, newest first. */
  history(): PastAttempt[]
}

/** A challenge that's over, as its history shows it. */
export interface PastAttempt {
  challenge: Challenge
  dayData: DayData
  days: Day[]
  tally: Tally
  /** `ended`: reset or stopped; `finished`: a completed round. */
  outcome: 'ended' | 'finished'
  /** The day an ended attempt stopped on. */
  endedOn: number | null
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
      ...emptySnapshot(),
      phase: user ? 'no-challenge' : 'signed-out',
      user,
      creativeToday,
      dayCloses: user ? closesAt(user.lateNightBufferHrs) : '00:00',
      dayClosesAt: user ? closingInstant(now, user.tz, user.lateNightBufferHrs, creativeToday) : '',
    }
    if (!user || !challenge) return empty

    const dayData = repo.getDayData(challenge.id)
    let days = statesOf(challenge, dayData, user, now)
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

    const ending: Ending | null =
      phase === 'prestart'
        ? { kind: 'redo' }
        : phase === 'reset-pending'
          ? { kind: 'stop', day: pending!.index }
          : phase === 'active'
            ? { kind: 'stop', day: currentIndex }
            : null

    // With the attempt ended there is no today to check in: don't draw one.
    if (phase === 'reset-pending') {
      days = days.map((d) => (d.state === 'today' ? { ...d, state: 'future' as const } : d))
    }
    const checkInOpen =
      (phase === 'active' || phase === 'finished') && currentIndex >= 1 && currentIndex <= totalDays

    return {
      phase,
      user,
      challenge,
      dayData,
      days,
      currentIndex,
      totalDays,
      streak: streaks(days, currentIndex),
      tally: tally(days, dayData),
      checkInOpen,
      resetMessage: phase === 'reset-pending' ? resetCopy(challenge, pending!.index) : null,
      missedDay: phase === 'reset-pending' ? pending!.index : null,
      creativeToday,
      dayCloses: closesAt(user.lateNightBufferHrs),
      dayClosesAt: closingInstant(now, user.tz, user.lateNightBufferHrs, creativeToday),
      ending,
      notice: noticeFor(challenge),
      stakes: {
        policy: challenge.missPolicy,
        tokensLeft:
          challenge.missPolicy === 'grace' ? tokensLeft(challenge) : null,
        extraDays: challenge.extraDays ?? 0,
      },
    }
  }

  function noticeFor(challenge: Challenge): RolloverEvent | null {
    const n = repo.pendingNotice()
    if (!n || n.challengeId !== challenge.id) return null
    return { kind: n.kind, message: n.message, days: n.days }
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

  function sync(): { snapshot: Snapshot; events: RolloverEvent[]; notice: RolloverEvent | null } {
    const now = clock()
    const { user } = context()
    let { challenge } = context()
    const events: RolloverEvent[] = []

    if (user && challenge && challenge.status === 'active') {
      const restored = reconcile(challenge)
      challenge = restored.challenge
      if (restored.days.length > 0) events.push({ kind: 'restore', message: '', days: restored.days })
    }

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
        events.push({ kind: outcome.action, message: '', days: [miss.index] })
      }
    }

    const told = challenge ? summarize(events, challenge) : []
    const notice = noticeOf(told)
    if (notice && challenge) repo.setPendingNotice({ ...notice, challengeId: challenge.id })
    return { snapshot: snapshotOf(user, challenge, now), events: told, notice }
  }

  /**
   * Undo misses that were made after all. Another device can sync in a
   * completion for a day this one already actioned as missed (it rolled over
   * on stale data): that day's skip or extension is given back, and the
   * token and extension counts are recounted from the day data itself, which
   * keeps them true after any merge.
   */
  function reconcile(challenge: Challenge): { challenge: Challenge; days: number[] } {
    const before = repo.getDayData(challenge.id)
    const made = before.actionedMisses.filter((d) => before.completions[d])
    for (const d of made) repo.clearMiss(challenge.id, d)
    const dd = made.length > 0 ? repo.getDayData(challenge.id) : before
    const next: Challenge = {
      ...challenge,
      skipTokensUsed: challenge.missPolicy === 'grace' ? dd.skips.length : challenge.skipTokensUsed,
      extraDays: challenge.missPolicy === 'extend' ? dd.actionedMisses.length : (challenge.extraDays ?? 0),
    }
    const changed =
      next.skipTokensUsed !== challenge.skipTokensUsed || next.extraDays !== (challenge.extraDays ?? 0)
    if (changed) repo.saveChallenge(next)
    // A sync's merge drops the miss of a made day before this runs; the
    // repository kept which days that was, on the device that had missed them.
    // (A recount alone can't say: the challenge row syncs on its own.)
    const days = [...new Set([...made, ...repo.takeRestoredMisses(challenge.id)])].sort((x, y) => x - y)
    return { challenge: changed ? next : challenge, days }
  }

  /** Today's challenge, when check-ins for `dayIndex` are open. */
  function openDay(dayIndex: number): Challenge | null {
    const snap = read()
    return snap.checkInOpen && dayIndex === snap.currentIndex ? snap.challenge : null
  }

  /**
   * Today's challenge when today takes artifacts: a check-in day, or a
   * maintenance day (a log and an artifact, no rules, nothing to complete).
   */
  function artifactDay(dayIndex: number): Challenge | null {
    const snap = read()
    if (snap.phase === 'maintenance' && dayIndex === snap.currentIndex) return snap.challenge
    return openDay(dayIndex)
  }

  /** Re-decide whether today is complete after any write to it. */
  function settle(challenge: Challenge, dayIndex: number): ToggleResult {
    if (challenge.status === 'maintenance') return { ok: true, justCompleted: false }
    const fresh = repo.getDayData(challenge.id)
    const complete = completionRules(challenge).every((r) => ruleMet(r, fresh, dayIndex))
    const wasComplete = Boolean(fresh.completions[dayIndex])
    if (complete && !wasComplete) {
      repo.saveDayCompletion(challenge.id, dayIndex, clock().toISOString())
      return { ok: true, justCompleted: true }
    }
    if (!complete && wasComplete) {
      repo.saveDayCompletion(challenge.id, dayIndex, null)
      return { ok: true, justCompleted: false, reopened: true }
    }
    return { ok: true, justCompleted: false }
  }

  /** Whether removing this artifact would take today back off the grid. */
  function wouldReopen(dayIndex: number, artifactId: string): boolean {
    const challenge = openDay(dayIndex)
    if (!challenge) return false
    const dd = repo.getDayData(challenge.id)
    if (!dd.completions[dayIndex]) return false
    const without: DayData = {
      ...dd,
      artifacts: { ...dd.artifacts, [dayIndex]: (dd.artifacts[dayIndex] ?? []).filter((a) => a.id !== artifactId) },
    }
    return !completionRules(challenge).every((r) => ruleMet(r, without, dayIndex))
  }

  function toggleRule(dayIndex: number, ruleId: string): ToggleResult {
    const challenge = openDay(dayIndex)
    const rule = challenge?.rules.find((r) => r.id === ruleId)
    if (!challenge || !rule || evidenceOf(rule)) return { ok: false }

    // Always decide from storage, never from what the UI last rendered, so a
    // double tap toggles back instead of setting the same value twice.
    const key = checkKey(dayIndex, ruleId)
    const checked = repo.getDayData(challenge.id).checks[key] === true
    repo.saveCheck(challenge.id, dayIndex, ruleId, !checked)
    return settle(challenge, dayIndex)
  }

  function saveLog(dayIndex: number, text: string): ToggleResult {
    const snap = read()
    const { challenge } = snap
    if (!challenge || dayIndex < 1 || dayIndex > snap.currentIndex) return { ok: false }
    repo.saveLog(challenge.id, dayIndex, {
      dayId: dayId(challenge.id, dayIndex),
      text: text.slice(0, MAX_LOG_CHARS),
      updatedAt: clock().toISOString(),
    })
    // A log typed for a closed day is still saved (it was written for that
    // day), but only today's completion can change.
    const today = openDay(dayIndex)
    return today ? settle(today, dayIndex) : { ok: true, justCompleted: false }
  }

  function attach(challenge: Challenge, dayIndex: number, artifact: Omit<Artifact, 'id' | 'dayId' | 'createdAt'>) {
    repo.saveArtifactMeta(challenge.id, dayIndex, {
      ...artifact,
      id: newId(),
      dayId: dayId(challenge.id, dayIndex),
      createdAt: clock().toISOString(),
    })
    return settle(challenge, dayIndex)
  }

  async function attachImage(dayIndex: number, blob: Blob): Promise<ToggleResult> {
    const challenge = artifactDay(dayIndex)
    if (!challenge) return { ok: false }
    const blobRef = await repo.saveArtifactBlob(blob)
    return attach(challenge, dayIndex, { kind: 'image', blobRef })
  }

  function attachLink(dayIndex: number, url: string): ToggleResult {
    const challenge = artifactDay(dayIndex)
    if (!challenge) return { ok: false }
    return attach(challenge, dayIndex, { kind: 'url', url })
  }

  async function removeArtifact(dayIndex: number, artifactId: string): Promise<ToggleResult> {
    const challenge = artifactDay(dayIndex)
    if (!challenge) return { ok: false }
    const artifact = repo.getDayData(challenge.id).artifacts[dayIndex]?.find((a) => a.id === artifactId)
    if (!artifact) return { ok: false }
    if (artifact.blobRef) await repo.deleteArtifactBlob(artifact.blobRef)
    repo.deleteArtifactMeta(challenge.id, dayIndex, artifactId)
    return settle(challenge, dayIndex)
  }

  function changeDayBoundary(change: DayBoundary): BoundaryResult {
    const snap = read()
    const { user } = snap
    if (!user) return { ok: false, reason: 'Sign in first.' }
    const next: User = { ...user, ...change }
    const now = clock()
    const before = snap.creativeToday
    const after = creativeDate(now, next.tz, next.lateNightBufferHrs)
    const running = snap.phase === 'active' || snap.phase === 'finished' || snap.phase === 'reset-pending'

    if (running && after > before && snap.checkInOpen) {
      const today = snap.days.find((d) => d.index === snap.currentIndex)
      if (today && today.state !== 'complete') {
        return {
          ok: false,
          reason: `Day ${today.index} isn’t made yet, and this would close it now. Make today first, or change this after ${clockTime(snap.dayCloses)}.`,
        }
      }
    }
    if (running && after < before) {
      const when =
        change.tz === undefined || change.tz === user.tz
          ? `after ${clockTime(closesAt(next.lateNightBufferHrs))}`
          : 'later today'
      return {
        ok: false,
        reason: `Right now this would take you back to ${longDay(after)}, a day that has already closed. Change it ${when}.`,
      }
    }
    repo.saveUser(next)
    return { ok: true }
  }

  function setReminder(time: string | null): void {
    const { user } = context()
    if (user) repo.saveUser({ ...user, reminderTime: time })
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
    repo.saveChallenge({
      ...challenge,
      status: 'archived',
      endedOnDay: snap.missedDay ?? undefined,
      endedBy: 'reset',
    })
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

  function endAttempt(): void {
    const { challenge, ending, phase } = read()
    if (!challenge || !ending) return // finished rounds close with closeForNewRound
    repo.saveChallenge({
      ...challenge,
      status: 'archived',
      // Never started: kept (it's the person's data) but out of history.
      endedOnDay: ending.kind === 'redo' ? 0 : ending.day,
      // Ended while a miss was pending, the miss ended it: history draws
      // that day as missed, exactly as a confirmed reset would.
      endedBy: phase === 'reset-pending' ? 'reset' : 'person',
    })
  }

  function history(): PastAttempt[] {
    return repo
      .getChallenges()
      .filter((c) => (c.status === 'archived' && c.endedOnDay !== 0) || c.status === 'completed')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((challenge) => {
        const dayData = repo.getDayData(challenge.id)
        const days = attemptDays(challenge, dayData)
        const finished = challenge.status === 'completed'
        return {
          challenge,
          dayData,
          days,
          tally: tally(days, dayData),
          outcome: finished ? 'finished' : 'ended',
          endedOn: finished ? null : attemptEnd(challenge, dayData),
        }
      })
  }

  return {
    sync,
    dismissNotice: () => repo.setPendingNotice(null),
    read,
    toggleRule,
    saveLog,
    attachImage,
    attachLink,
    removeArtifact,
    wouldReopen,
    changeDayBoundary,
    setReminder,
    start,
    confirmReset,
    enterMaintenance,
    closeForNewRound,
    endAttempt,
    history,
  }
}

/** The Snapshot with nothing in it: signed out, no challenge. */
export function emptySnapshot(): Snapshot {
  return {
    phase: 'signed-out',
    user: null,
    challenge: null,
    dayData: emptyDayData(),
    days: [],
    currentIndex: 0,
    totalDays: TOTAL_DAYS,
    streak: { current: 0, longest: 0 },
    tally: EMPTY_TALLY,
    checkInOpen: false,
    resetMessage: null,
    missedDay: null,
    creativeToday: '',
    dayCloses: '00:00',
    stakes: null,
    dayClosesAt: '',
    ending: null,
    notice: null,
  }
}

/** Grace skip tokens still unspent in this attempt. */
export function tokensLeft(challenge: Challenge): number {
  return Math.max(0, MAX_SKIP_TOKENS - challenge.skipTokensUsed)
}

/** Whether a day has a written log (not just whitespace). */
export function hasLog(dayData: DayData, dayIndex: number): boolean {
  return (dayData.logs[dayIndex]?.text ?? '').trim().length > 0
}

/**
 * The last day an archived attempt reached. Attempts archived before the end
 * day was recorded fall back to their first gap.
 */
export function attemptEnd(challenge: Challenge, dayData: DayData): number {
  if (challenge.endedOnDay !== undefined) return challenge.endedOnDay
  const total = challengeLength(challenge)
  let end = 1
  while (end <= total && (dayData.completions[end] || dayData.skips.includes(end))) end++
  return end
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

/**
 * What satisfies a rule. Challenges started before evidence rules existed
 * still have the untouched default "Log the day" / "Capture an artifact"
 * rules; those are recognised by id and name.
 */
export function evidenceOf(rule: Rule): Evidence | undefined {
  if (rule.evidence) return rule.evidence
  if (rule.id === 'log' && rule.name === 'Log the day') return 'log'
  if (rule.id === 'artifact' && rule.name === 'Capture an artifact') return 'artifact'
  return undefined
}

/** Whether a rule is met on a day: ticked, or its evidence is present. */
export function ruleMet(rule: Rule, dayData: DayData, dayIndex: number): boolean {
  switch (evidenceOf(rule)) {
    case 'log':
      return hasLog(dayData, dayIndex)
    case 'artifact':
      return (dayData.artifacts[dayIndex]?.length ?? 0) > 0
    default:
      return dayData.checks[checkKey(dayIndex, rule.id)] === true
  }
}

/**
 * The grid of an archived attempt, frozen where it ended: days after the miss
 * that ended it are drawn as never reached, not as a wall of misses.
 */
export function attemptDays(challenge: Challenge, dayData: DayData): Day[] {
  const total = challengeLength(challenge)
  // A finished round has no end day: every day it had counts.
  const end = challenge.status === 'completed' ? total : attemptEnd(challenge, dayData)
  // The day an attempt was quit on was never missed: only a reset's end day was.
  const lastMissed = challenge.endedBy === 'person' ? end - 1 : end
  const days: Day[] = []
  for (let index = 1; index <= total; index++) {
    const completedAt = dayData.completions[index] ?? null
    const state: Day['state'] = completedAt
      ? 'complete'
      : dayData.skips.includes(index)
        ? 'skipped'
        : index <= lastMissed
          ? 'missed'
          : 'future'
    days.push({ challengeId: challenge.id, index, state, completedAt })
  }
  return days
}

const EMPTY_TALLY: Tally = { made: 0, skipped: 0, missed: 0, logsWritten: 0, artifactsKept: 0 }

/** Count a challenge's days (live or archived) and what was kept on them. */
export function tally(days: Day[], dayData: DayData): Tally {
  const t = { ...EMPTY_TALLY }
  for (const d of days) {
    if (d.state === 'complete') t.made++
    else if (d.state === 'skipped') t.skipped++
    else if (d.state === 'missed') t.missed++
    if (hasLog(dayData, d.index)) t.logsWritten++
    t.artifactsKept += dayData.artifacts[d.index]?.length ?? 0
  }
  return t
}

/**
 * The milestone completing `dayIndex` reaches, if any. The last day is always
 * the finish, so an Extend challenge that runs past 75 doesn't finish early.
 */
export function milestoneAt(dayIndex: number, totalDays: number): Milestone | null {
  if (dayIndex === totalDays) return 'final'
  if (dayIndex > totalDays) return null
  if (dayIndex === 7) return 'week'
  if (dayIndex === 25) return 'third'
  if (dayIndex === 50) return 'two-thirds'
  return null
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

/**
 * When the creative day `creativeToday` closes: the local midnight after it,
 * plus the buffer. Counted from the local wall clock (a DST shift that night
 * moves it by the hour it moves the clock).
 */
function closingInstant(now: Date, tz: string, bufferHrs: number, creativeToday: string): string {
  const [h, m] = localTime(now, tz).split(':').map(Number)
  const intoNextDay = daysBetween(creativeToday, localDate(now, tz)) // 0 before midnight, 1 after
  const minutesLeft = (1 - intoNextDay) * 1440 + Math.round(bufferHrs) * 60 - (h * 60 + m)
  const at = new Date(now.getTime() + minutesLeft * 60_000)
  at.setSeconds(0, 0)
  return at.toISOString()
}

/** The local time the creative day closes: midnight plus the buffer. */
function closesAt(bufferHrs: number): string {
  const h = ((Math.round(bufferHrs) % 24) + 24) % 24
  return `${String(h).padStart(2, '0')}:00`
}

function dayList(days: number[]): string {
  if (days.length === 1) return `Day ${days[0]}`
  const contiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1)
  if (contiguous) return `Days ${days[0]}–${days[days.length - 1]}`
  return `Days ${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`
}

function resetCopy(challenge: Challenge, missedDay: number): string {
  const why =
    challenge.missPolicy === 'grace'
      ? 'with no skip tokens left, so this attempt ends here'
      : 'Under Classic, that ends this attempt'
  const n = challenge.rules.length
  return challenge.missPolicy === 'grace'
    ? `Day ${missedDay} was missed ${why}. Restarting keeps your ${n} rules and makes today Day 1.`
    : `Day ${missedDay} was missed. ${why}. Restarting keeps your ${n} rules and makes today Day 1.`
}

/**
 * Everything one sync has to say, as one notice: nothing is dropped when a
 * restore and a newly spent token happen together. It takes the kind of the
 * consequence that cost something (a skip or an extension) over a restore.
 */
function noticeOf(events: RolloverEvent[]): RolloverEvent | null {
  if (events.length === 0) return null
  if (events.length === 1) return events[0]
  const costly = events.find((e) => e.kind !== 'restore') ?? events[0]
  // `days` are the costly kind's (the notice is titled by it); the message
  // says everything.
  return { kind: costly.kind, days: costly.days, message: events.map((e) => e.message).join(' ') }
}

/** One event per kind, so a long absence reads as one message, not twenty. */
function summarize(events: RolloverEvent[], challenge: Challenge): RolloverEvent[] {
  const out: RolloverEvent[] = []
  const skips = events.filter((e) => e.kind === 'skip').flatMap((e) => e.days)
  if (skips.length > 0) {
    const left = tokensLeft(challenge)
    const were = skips.length === 1 ? 'was' : 'were'
    const covered = skips.length === 1 ? 'A skip token covered it' : 'Skip tokens covered them'
    out.push({
      kind: 'skip',
      days: skips,
      message:
        `${dayList(skips)} ${were} missed. ${covered}, so your streak is intact — ${left} of ${MAX_SKIP_TOKENS} left.` +
        // The moment the stake changes is the moment to say it.
        (left === 0 ? ' No skips left: the next miss ends this attempt.' : ''),
    })
  }
  const restored = events.filter((e) => e.kind === 'restore').flatMap((e) => e.days)
  if (restored.length > 0) {
    const was = restored.length === 1 ? 'was' : 'were'
    const back =
      challenge.missPolicy === 'grace'
        ? restored.length === 1
          ? 'its skip token is back'
          : 'their skip tokens are back'
        : challenge.missPolicy === 'extend'
          ? 'the challenge is shorter again'
          : 'nothing was lost'
    out.push({
      kind: 'restore',
      days: restored,
      message: `${dayList(restored)} ${was} made on another device, so ${back}.`,
    })
  }
  const extended = events.filter((e) => e.kind === 'extend').flatMap((e) => e.days)
  if (extended.length > 0) {
    const were = extended.length === 1 ? 'was' : 'were'
    const total = challengeLength(challenge)
    out.push({
      kind: 'extend',
      days: extended,
      message: `${dayList(extended)} ${were} missed. Extend adds ${extended.length === 1 ? 'it' : 'them'} to the end: the challenge now runs ${total} days.`,
    })
  }
  return out
}
