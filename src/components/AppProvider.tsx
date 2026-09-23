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
import { DayData, Repository, emptyDayData, newId, newUser } from '@/lib/repository'
import {
  ChallengeDraft,
  ChallengeSession,
  Phase,
  Snapshot,
  ToggleResult,
  createChallengeSession,
} from '@/lib/challengeSession'
import { Challenge, Day, TOTAL_DAYS, User } from '@/lib/types'

export type BannerKind = 'skip' | 'extend' | 'reset'

export interface Banner {
  kind: BannerKind
  message: string
}

interface Derived {
  days: Day[]
  currentIndex: number
  totalDays: number
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
  phase: Phase
  /** Why the attempt ended, while `phase` is 'reset-pending'. */
  resetMessage: string | null
  /** Today's creative date (YYYY-MM-DD), late-night buffer applied. */
  creativeToday: string
  /** A one-time note about a consequence applied at rollover (skip/extend). */
  banner: Banner | null
  dismissBanner: () => void
  /** Resolves 'magic-link-sent' when a real auth email was sent (Supabase). */
  signIn: (email: string) => Promise<'local' | 'magic-link-sent'>
  signInWithGoogle: () => Promise<void>
  /** True when a Supabase backend is configured (real auth + sync). */
  supabaseEnabled: boolean
  signOut: () => void
  /** Re-read and roll over (after a write that bypassed the session). */
  refresh: () => void
  toggleTask: (dayIndex: number, ruleId: string) => ToggleResult
  saveLog: (dayIndex: number, text: string) => void
  startChallenge: (draft: ChallengeDraft) => Challenge
  confirmReset: () => void
  enterMaintenance: () => void
  closeForNewRound: () => void
}

const AppContext = createContext<AppValue | null>(null)

const EMPTY: Snapshot = {
  phase: 'signed-out',
  user: null,
  challenge: null,
  dayData: emptyDayData(),
  days: [],
  currentIndex: 0,
  totalDays: TOTAL_DAYS,
  streak: { current: 0, longest: 0 },
  completedCount: 0,
  resetMessage: null,
  creativeToday: '',
}

/** How often to check whether the creative day has rolled over. */
const TICK_MS = 60_000

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Built once, lazily, and only in the browser: both implementations touch
  // localStorage/IndexedDB, which don't exist during server rendering.
  const [repo] = useState<Repository | null>(() => {
    if (typeof window === 'undefined') return null
    const local = new LocalRepository()
    return supabase ? new SyncedRepository(local, supabase) : local
  })
  const [session] = useState<ChallengeSession | null>(() =>
    repo ? createChallengeSession(repo) : null,
  )

  const [loading, setLoading] = useState(true)
  const [snap, setSnap] = useState<Snapshot>(EMPTY)
  const [banner, setBanner] = useState<Banner | null>(null)

  /** Apply rollover consequences and re-read. Surfaces any new consequence. */
  const sync = useCallback(() => {
    if (!session) return
    const { snapshot, events } = session.sync()
    setSnap(snapshot)
    const last = events[events.length - 1]
    if (last) setBanner({ kind: last.kind, message: last.message })
    setLoading(false)
  }, [session])

  // Refreshing is a sync: it writes nothing unless a day has newly been
  // missed, and a settings change (timezone, buffer) can move the day.
  const refresh = sync

  useEffect(() => {
    // Hydration from localStorage/IndexedDB, which are unreadable during
    // render and on the server — an effect is the only place this can happen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    sync()
  }, [sync])

  // The creative day changes while a tab stays open or a PWA sits in the
  // background. Re-sync when it does, so today's check-in never writes to
  // yesterday and a missed day is actioned as soon as it becomes one.
  useEffect(() => {
    if (!session) return
    const onChange = () => {
      if (session.read().creativeToday !== snap.creativeToday) sync()
    }
    const timer = setInterval(onChange, TICK_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') onChange()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onChange)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onChange)
    }
  }, [session, snap.creativeToday, sync])

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
              sync()
            })
        } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
          synced.disconnectRemote()
          synced.setSignedIn(false)
          sync()
        }
      }, 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [sync, repo])

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
      const existing = repo.getUser()
      if (!existing || existing.email !== email) repo.saveUser(newUser(newId(), email))
      repo.setSignedIn(true)
      sync()
      return 'local'
    },
    [sync, repo],
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
    setBanner(null)
    sync()
  }, [sync, repo])

  const actions = useMemo(() => {
    const noop: ToggleResult = { ok: false }
    return {
      toggleTask(dayIndex: number, ruleId: string): ToggleResult {
        if (!session) return noop
        const result = session.toggleTask(dayIndex, ruleId)
        // A refused toggle means the day moved on under the user; either way
        // the snapshot catches up.
        sync()
        return result
      },
      saveLog(dayIndex: number, text: string) {
        session?.saveLog(dayIndex, text)
      },
      startChallenge(draft: ChallengeDraft): Challenge {
        if (!session) throw new Error('Storage is unavailable.')
        const c = session.start(draft)
        sync()
        return c
      },
      confirmReset() {
        session?.confirmReset()
        setBanner(null)
        sync()
      },
      enterMaintenance() {
        session?.enterMaintenance()
        sync()
      },
      closeForNewRound() {
        session?.closeForNewRound()
        sync()
      },
    }
  }, [session, sync])

  const value: AppValue = {
    loading,
    repo: repo as Repository,
    user: snap.user,
    challenge: snap.challenge,
    dayData: snap.dayData,
    derived: {
      days: snap.days,
      currentIndex: snap.currentIndex,
      totalDays: snap.totalDays,
      streak: snap.streak,
      completedCount: snap.completedCount,
    },
    phase: snap.phase,
    resetMessage: snap.resetMessage,
    creativeToday: snap.creativeToday,
    banner,
    dismissBanner: () => setBanner(null),
    signIn,
    signInWithGoogle,
    supabaseEnabled: isSupabaseConfigured(),
    signOut,
    refresh,
    ...actions,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
