// Domain types for 75 Create. Mirrors the data model in the design spec (§5).

export type Medium =
  | 'writing'
  | 'drawing'
  | 'music'
  | 'photography'
  | 'video'
  | 'code'
  | 'mixed'
  | 'other'

export type MissPolicy = 'classic' | 'grace' | 'extend'

export type DayState = 'future' | 'complete' | 'missed' | 'skipped' | 'today'

export type ChallengeStatus =
  | 'active'
  | 'archived'
  | 'completed'
  | 'maintenance'

/**
 * What satisfies a rule. Plain rules are ticked by hand; an evidence rule is
 * met by the evidence itself — the day's log or an artifact — so the proof
 * can't be skipped with a checkbox.
 */
export type Evidence = 'log' | 'artifact'

export interface Rule {
  id: string
  name: string
  description: string
  required: boolean
  evidence?: Evidence
}

export interface Challenge {
  id: string
  medium: Medium
  rules: Rule[]
  missPolicy: MissPolicy
  /** ISO calendar date (YYYY-MM-DD) in the user's timezone. */
  startDate: string
  status: ChallengeStatus
  skipTokensUsed: number
  whyNote: string
  /** ISO timestamp. */
  createdAt: string
  maintenanceMode: boolean
  /** Days added to the base 75 by the Extend policy. */
  extraDays: number
  /** Archived attempts: the day they ended on (the miss, or the day quit). */
  endedOnDay?: number
  /**
   * Who ended an archived attempt: a miss (`reset`) or the person
   * (`person`, quitting). A quit day was never missed, so it isn't drawn
   * as one. Absent on attempts archived before this was recorded (resets).
   */
  endedBy?: 'reset' | 'person'
}

export interface Day {
  challengeId: string
  /** 1-based day index. */
  index: number
  state: DayState
  /** ISO timestamp of completion, or null. */
  completedAt: string | null
}

export interface TaskCheck {
  dayId: string
  ruleId: string
  checked: boolean
}

export interface Log {
  dayId: string
  text: string
  updatedAt: string
}

export interface Artifact {
  id: string
  dayId: string
  kind: 'image' | 'url'
  /** IndexedDB key for kind 'image'. */
  blobRef?: string
  /** External URL for kind 'url'. */
  url?: string
  createdAt: string
}

export interface User {
  id: string
  email: string
  /** IANA timezone, e.g. "America/New_York". */
  tz: string
  /** Hours past midnight a day can still be completed (late-night buffer). */
  lateNightBufferHrs: number
  createdAt: string
  /** "HH:MM" local reminder time, or null if reminders are off. */
  reminderTime: string | null
}

// Shared with the Edge Functions, so the reminders apply the same stakes.
export { MAX_SKIP_TOKENS, TOTAL_DAYS } from '../../supabase/functions/_shared/missPolicy'
export const MAX_LOG_CHARS = 500
export const MIN_RULES = 3
export const MAX_RULES = 7
export const DEFAULT_BUFFER_HRS = 3

/** The default 75 Create rule set (design spec / PRD §4). */
export const DEFAULT_RULES: Rule[] = [
  {
    id: 'create',
    name: 'Create for 30+ minutes',
    description:
      'Work on your craft: draw, write, compose, film, code art — anything generative in your medium.',
    required: true,
  },
  {
    id: 'study',
    name: 'Study one piece of work',
    description:
      'Actively analyze something good in your medium — a painting, a chapter, a track. Not passive scrolling.',
    required: true,
  },
  {
    id: 'log',
    name: 'Log the day',
    description: 'A short note (1–3 sentences) on what you made or learned.',
    required: true,
    evidence: 'log',
  },
  {
    id: 'artifact',
    name: 'Capture an artifact',
    description:
      "Upload or link a photo, snippet, or excerpt of the day's work (private by default).",
    required: true,
    evidence: 'artifact',
  },
  {
    id: 'no-passive',
    name: 'Create before consuming',
    description:
      "The day's first engagement with your craft must be making, not scrolling.",
    required: true,
  },
]
