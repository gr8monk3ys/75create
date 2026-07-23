'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { LocalRepository } from '@/lib/localRepository'
import { DayData, Repository, newId } from '@/lib/repository'
import {
  applyMissPolicy,
  computeDayStates,
  currentDayIndex,
  streaks,
} from '@/lib/challengeEngine'
import { Challenge, Day, TOTAL_DAYS, User } from '@/lib/types'

export type BannerKind = 'skip' | 'extend' | 'reset' | 'milestone' | 'done'

export interface Banner {
  kind: BannerKind
  message: string
}

interface Derived {
  days: Day[]
  currentIndex: number
  streak: { current: number; longest: number }
  completedCount: number
}

interface AppValue {
  loading: boolean
  repo: Repository
  user: User | null
  challenge: Challenge | null
  dayData: DayData
  derived: Derived
  banner: Banner | null
  dismissBanner: () => void
  signIn: (email: string) => void
  signOut: () => void
  /** Re-read from storage and recompute (call after any mutation). */
  refresh: () => void
  /** Classic/grace-exhausted reset requires explicit confirmation. */
  confirmReset: () => void
}

const AppContext = createContext<AppValue | null>(null)

const emptyDerived: Derived = {
  days: [],
  currentIndex: 0,
  streak: { current: 0, longest: 0 },
  completedCount: 0,
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const repoRef = useRef<Repository | null>(null)
  if (!repoRef.current && typeof window !== 'undefined') {
    repoRef.current = new LocalRepository()
  }

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [dayData, setDayData] = useState<DayData>({
    completions: {},
    logs: {},
    checks: {},
    artifacts: {},
    skips: [],
    actionedMisses: [],
  })
  const [banner, setBanner] = useState<Banner | null>(null)

  /**
   * Read the active challenge, run day-boundary rollover (applying skip/extend
   * consequences and surfacing a reset confirmation), then load state.
   */
  const load = useCallback(() => {
    const repo = repoRef.current
    if (!repo) return
    if (!repo.isSignedIn()) {
      setUser(null)
      setChallenge(null)
      setLoading(false)
      return
    }
    setUser(repo.getUser())

    let active = repo.getActiveChallenge()
    if (active && active.status === 'active') {
      active = runRollover(repo, active, (b) => setBanner(b))
    }
    setChallenge(active)
    setDayData(active ? repo.getDayData(active.id) : emptyDayDataValue())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const refresh = useCallback(() => load(), [load])

  const derived = useMemo<Derived>(() => {
    if (!challenge || !user) return emptyDerived
    const now = new Date()
    const currentIndex = currentDayIndex(
      challenge,
      now,
      user.tz,
      user.lateNightBufferHrs,
    )
    const days = computeDayStates(
      challenge,
      dayData.completions,
      now,
      user.tz,
      user.lateNightBufferHrs,
      dayData.skips,
    )
    const streak = streaks(days, currentIndex)
    const completedCount = Object.keys(dayData.completions).length
    return { days, currentIndex, streak, completedCount }
  }, [challenge, user, dayData])

  const signIn = useCallback(
    (email: string) => {
      const repo = repoRef.current
      if (!repo) return
      let u = repo.getUser()
      if (!u || u.email !== email) {
        u = {
          id: newId(),
          email,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          lateNightBufferHrs: 3,
          createdAt: new Date().toISOString(),
          reminderTime: null,
        }
        repo.saveUser(u)
      }
      repo.setSignedIn(true)
      load()
    },
    [load],
  )

  const signOut = useCallback(() => {
    repoRef.current?.setSignedIn(false)
    load()
  }, [load])

  const confirmReset = useCallback(() => {
    const repo = repoRef.current
    if (!repo || !challenge) return
    // Archive the failed attempt and start a fresh one today with the same rules.
    repo.saveChallenge({ ...challenge, status: 'archived' })
    const fresh: Challenge = {
      ...challenge,
      id: newId(),
      status: 'active',
      startDate: localToday(user?.tz ?? 'UTC'),
      skipTokensUsed: 0,
      extraDays: 0,
      createdAt: new Date().toISOString(),
    }
    repo.saveChallenge(fresh)
    setBanner(null)
    load()
  }, [challenge, user, load])

  const value: AppValue = {
    loading,
    repo: repoRef.current as Repository,
    user,
    challenge,
    dayData,
    derived,
    banner,
    dismissBanner: () => setBanner(null),
    signIn,
    signOut,
    refresh,
    confirmReset,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

// ---- helpers ----

function emptyDayDataValue(): DayData {
  return {
    completions: {},
    logs: {},
    checks: {},
    artifacts: {},
    skips: [],
    actionedMisses: [],
  }
}

function localToday(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')!.value
  const m = parts.find((p) => p.type === 'month')!.value
  const d = parts.find((p) => p.type === 'day')!.value
  return `${y}-${m}-${d}`
}

/**
 * Apply miss-policy consequences for any un-actioned missed days. Skips and
 * extensions are applied automatically; a reset surfaces a confirmation banner
 * (Classic mode never auto-wipes progress — PRD §5.3). Returns the possibly
 * updated challenge.
 */
function runRollover(
  repo: Repository,
  challenge: Challenge,
  setBanner: (b: Banner) => void,
): Challenge {
  const user = repo.getUser()
  if (!user) return challenge
  const now = new Date()
  let current = challenge
  let dd = repo.getDayData(current.id)

  // Process missed days oldest-first until none remain un-actioned.
  // Bounded by TOTAL_DAYS to avoid any pathological loop.
  for (let guard = 0; guard < TOTAL_DAYS + current.extraDays + 1; guard++) {
    const days = computeDayStates(
      current,
      dd.completions,
      now,
      user.tz,
      user.lateNightBufferHrs,
      dd.skips,
    )
    const miss = days.find(
      (d) => d.state === 'missed' && !dd.actionedMisses.includes(d.index),
    )
    if (!miss) break

    const outcome = applyMissPolicy(current, days, miss.index)
    if (outcome.action === 'reset') {
      setBanner({ kind: 'reset', message: outcome.message })
      break // wait for user confirmation; do not mutate.
    }
    if (outcome.action === 'skip') {
      repo.addSkip(current.id, miss.index)
      repo.addActionedMiss(current.id, miss.index)
      current = { ...current, skipTokensUsed: outcome.newSkipTokensUsed }
      repo.saveChallenge(current)
      setBanner({ kind: 'skip', message: outcome.message })
    } else if (outcome.action === 'extend') {
      repo.addActionedMiss(current.id, miss.index)
      current = { ...current, extraDays: outcome.extraDays }
      repo.saveChallenge(current)
      setBanner({ kind: 'extend', message: outcome.message })
    }
    dd = repo.getDayData(current.id)
  }

  return current
}
