// The setup wizard's draft, kept for the tab (sessionStorage) so a reload or
// an evicted tab doesn't lose the rules someone typed. Tied to the account
// that wrote it (a device can be shared) and checked field by field on the
// way back in: anything unexpected starts fresh.

import { MAX_RULES, Medium, MissPolicy, Rule } from './types'

const KEY = '75create.setupDraft'
const MEDIA: Medium[] = ['writing', 'drawing', 'music', 'photography', 'video', 'code', 'mixed', 'other']
const POLICIES: MissPolicy[] = ['classic', 'grace', 'extend']

export interface SetupDraft {
  step: number
  medium: Medium
  rules: Rule[]
  policy: MissPolicy
  startChoice: 'today' | 'future'
  futureDate: string
  why: string
}

function isRule(r: unknown): r is Rule {
  if (!r || typeof r !== 'object') return false
  const x = r as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    typeof x.description === 'string' &&
    typeof x.required === 'boolean' &&
    (x.evidence === undefined || x.evidence === 'log' || x.evidence === 'artifact')
  )
}

/**
 * The saved draft for `userId`, or null. A start date that has since passed
 * (`earliest` is tomorrow's creative date) is dropped, so the lock-in never
 * promises a Day 1 that start() would move.
 */
export function readSetupDraft(userId: string, earliest?: string): SetupDraft | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as { userId?: unknown; draft?: SetupDraft } | null
    const d = saved?.draft
    if (!saved || saved.userId !== userId || !d) return null
    if (![0, 1, 2].includes(d.step) || !MEDIA.includes(d.medium) || !POLICIES.includes(d.policy)) return null
    if (!Array.isArray(d.rules) || d.rules.length > MAX_RULES || !d.rules.every(isRule)) return null
    if (d.startChoice !== 'today' && d.startChoice !== 'future') return null
    if (typeof d.futureDate !== 'string' || typeof d.why !== 'string') return null
    const stale = d.futureDate !== '' && earliest !== undefined && d.futureDate < earliest
    return stale ? { ...d, futureDate: '' } : d
  } catch {
    return null
  }
}

export function writeSetupDraft(userId: string, draft: SetupDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ userId, draft }))
  } catch {
    /* storage unavailable: the draft just won't survive a reload */
  }
}

/** Forget the draft: on Start, and on sign-out (the next account never sees it). */
export function clearSetupDraft(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}
