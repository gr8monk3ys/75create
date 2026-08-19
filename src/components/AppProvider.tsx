'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { LocalRepository } from '@/lib/localRepository'
import { SyncedRepository } from '@/lib/syncedRepository'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
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
  /** Resolves 'magic-link-sent' when a real auth email was sent (Supabase). */
  signIn: (email: string) => Promise<'local' | 'magic-link-sent'>
  signInWithGoogle: () => Promise<void>
  /** True when a Supabase backend is configured (real auth + sync). */
  supabaseEnabled: boolean
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
  // Built once, lazily, and only in the browser: both implementations touch
  // localStorage/IndexedDB, which don't exist during server rendering.
  const [repo] = useState<Repository | null>(() => {
    if (typeof window === 'undefined') return null
    const local = new LocalRepository()
    return supabase ? new SyncedRepository(local, supabase) : local
  })

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
  }, [repo])

  useEffect(() => {
    // Hydration from localStorage/IndexedDB, which are unreadable during
    // render and on the server — an effect is the only place this can happen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Real auth: when Supabase is configured the server session is the source of
  // truth for being signed in, and the prototype local session is disabled.
  useEffect(() => {
    if (!supabase) return
    const synced = repo as SyncedRepository | null
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // setTimeout: supabase-js warns against calling its APIs directly inside
      // this callback (deadlock risk).
      setTimeout(() => {
        if (!synced) return
        if (session?.user) {
          void synced
            .connectRemote(session.user.id, session.user.email ?? '')
            .then(() => {
              synced.setSignedIn(true)
              load()
            })
        } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
          synced.disconnectRemote()
          synced.setSignedIn(false)
          load()
        }
      }, 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [load, repo])

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
    async (email: string): Promise<'local' | 'magic-link-sent'> => {
      if (supabase) {
        await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        })
        return 'magic-link-sent'
      }
      if (!repo) return 'local'
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
      return 'local'
    },
    [load, repo],
  )

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
  }, [])

  const signOut = useCallback(() => {
    if (supabase) void supabase.auth.signOut()
    repo?.setSignedIn(false)
    load()
  }, [load, repo])

  const confirmReset = useCallback(() => {
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
  }, [challenge, user, load, repo])

  const value: AppValue = {
    loading,
    repo: repo as Repository,
    user,
    challenge,
    dayData,
    derived,
    banner,
    dismissBanner: () => setBanner(null),
    signIn,
    signInWithGoogle,
    supabaseEnabled: isSupabaseConfigured(),
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
