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
import type { SyncedRepository } from '@/lib/syncedRepository'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseConfigured } from '@/lib/backend'
import { DayData, Repository, emptyDayData, newId, newUser } from '@/lib/repository'
import {
  BoundaryResult,
  ChallengeDraft,
  ChallengeSession,
  DayBoundary,
  Phase,
  Snapshot,
  Stakes,
  Tally,
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
  tally: Tally
  /** Whether today's challenge day takes check-ins. */
  checkInOpen: boolean
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
  missedDay: number | null
  /** Today's creative date (YYYY-MM-DD), late-night buffer applied. */
  creativeToday: string
  /** Local "HH:MM" at which today's creative day closes. */
  dayCloses: string
  stakes: Stakes | null
  /** A one-time note about a consequence applied at rollover (skip/extend). */
  banner: Banner | null
  dismissBanner: () => void
  /** Resolves 'magic-link-sent' when a real auth email was sent (Supabase). */
  signIn: (email: string) => Promise<'local' | 'magic-link-sent'>
  signInWithGoogle: () => Promise<void>
  /** True when a Supabase backend is configured (real auth + sync). */
  supabaseEnabled: boolean
  signOut: () => void
  /** Move the day boundary; refused, with the reason, if it would decide a day. */
  changeDayBoundary: (change: DayBoundary) => BoundaryResult
  setReminder: (time: string | null) => void
  toggleTask: (dayIndex: number, ruleId: string) => ToggleResult
  saveLog: (dayIndex: number, text: string) => ToggleResult
  attachImage: (dayIndex: number, blob: Blob) => Promise<ToggleResult>
  attachLink: (dayIndex: number, url: string) => ToggleResult
  removeArtifact: (dayIndex: number, artifactId: string) => Promise<ToggleResult>
  wouldReopen: (dayIndex: number, artifactId: string) => boolean
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
  tally: { made: 0, skipped: 0, missed: 0, logsWritten: 0, artifactsKept: 0 },
  checkInOpen: false,
  resetMessage: null,
  missedDay: null,
  creativeToday: '',
  dayCloses: '00:00',
  stakes: null,
}

// A skip or extension notice stays until dismissed, not until the next reload:
// it is the only place the user learns a token was spent while they were away.
const NOTICE_KEY = '75create.notice.v1'

function readNotice(): Banner | null {
  try {
    const raw = localStorage.getItem(NOTICE_KEY)
    return raw ? (JSON.parse(raw) as Banner) : null
  } catch {
    return null
  }
}

function writeNotice(banner: Banner | null) {
  try {
    if (banner) localStorage.setItem(NOTICE_KEY, JSON.stringify(banner))
    else localStorage.removeItem(NOTICE_KEY)
  } catch {
    /* storage unavailable: the notice just won't survive a reload */
  }
}

interface Stack {
  repo: Repository
  session: ChallengeSession
  client: SupabaseClient | null
}

function sameDays(a: Day[], b: Day[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].state !== b[i].state || a[i].completedAt !== b[i].completedAt || a[i].index !== b[i].index) {
      return false
    }
  }
  return true
}

/** How often to check whether the creative day has rolled over. */
const TICK_MS = 60_000

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Built once and only in the browser: both repositories touch
  // localStorage/IndexedDB, which don't exist during server rendering. With no
  // backend configured the local stack is ready on first render; with one, the
  // Supabase SDK and the sync layer are fetched first, so a local-only build
  // never downloads them.
  const [stack, setStack] = useState<Stack | null>(() => {
    if (typeof window === 'undefined' || supabaseConfigured) return null
    const repo = new LocalRepository()
    return { repo, session: createChallengeSession(repo), client: null }
  })
  const repo = stack?.repo ?? null
  const session = stack?.session ?? null
  const supabase = stack?.client ?? null

  useEffect(() => {
    if (!supabaseConfigured || stack) return
    let cancelled = false
    void Promise.all([import('@/lib/supabase'), import('@/lib/syncedRepository')]).then(
      ([{ supabase: client }, { SyncedRepository: Synced }]) => {
        if (cancelled || !client) return
        const repo = new Synced(new LocalRepository(), client)
        setStack({ repo, session: createChallengeSession(repo), client })
      },
    )
    return () => {
      cancelled = true
    }
  }, [stack])

  const [loading, setLoading] = useState(true)
  // With a backend, being signed in is only known once Supabase reports its
  // session (and any account data is pulled). Until then the app is still
  // loading: rendering "signed out" first would bounce a magic-link arrival
  // to /signin.
  const [authKnown, setAuthKnown] = useState(!supabaseConfigured)
  const [snap, setSnap] = useState<Snapshot>(EMPTY)
  const [banner, setBanner] = useState<Banner | null>(null)

  /** Apply rollover consequences and re-read. Surfaces any new consequence. */
  const sync = useCallback(() => {
    if (!session) return
    const { snapshot, events } = session.sync()
    // The day states only change at rollover or completion, not on every
    // autosave: keep the previous array while they're equal, so the grids
    // and header don't re-render while someone types.
    setSnap((prev) => (sameDays(prev.days, snapshot.days) ? { ...snapshot, days: prev.days } : snapshot))
    const last = events[events.length - 1]
    if (last) {
      const notice: Banner = { kind: last.kind, message: last.message }
      writeNotice(notice)
      setBanner(notice)
    } else if (snapshot.phase === 'signed-out') {
      setBanner(null)
    } else {
      setBanner((b) => b ?? readNotice())
    }
    setLoading(false)
  }, [session])

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
            .then(() => synced.setSignedIn(true))
            // Offline or the pull failed: the local copy is still this
            // account's, so carry on with it rather than hang on loading.
            .catch(() => synced.setSignedIn(true))
            .finally(() => {
              sync()
              setAuthKnown(true)
            })
        } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
          synced.disconnectRemote()
          synced.setSignedIn(false)
          sync()
          setAuthKnown(true)
        }
      }, 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [sync, repo, supabase])

  const signIn = useCallback(
    async (email: string): Promise<'local' | 'magic-link-sent'> => {
      if (supabase) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        })
        // Rate limits and bad addresses come back here: never claim an email
        // is on its way when it isn't.
        if (error) throw new Error(error.message)
        return 'magic-link-sent'
      }
      // The storage layer is still being built (a backend build fetching its
      // SDK): nothing can be signed into yet.
      if (!repo) throw new Error('Still starting up. Try again in a moment.')
      if (!(repo instanceof LocalRepository)) return 'local'
      // Prototype auth: an email is an account. A different email switches
      // to that account's data (parking the current one), never inherits it.
      const current = repo.getUser()
      if (!current) repo.saveUser(newUser(newId(), email))
      else if (current.email !== email) {
        const known = repo.parkedUsers().find((u) => u.email === email)
        repo.switchUser(known ?? newUser(newId(), email))
      }
      repo.setSignedIn(true)
      sync()
      return 'local'
    },
    [sync, repo, supabase],
  )

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
  }, [supabase])

  const signOut = useCallback(() => {
    if (supabase) void supabase.auth.signOut()
    repo?.setSignedIn(false)
    writeNotice(null)
    setBanner(null)
    sync()
  }, [sync, repo, supabase])

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
      saveLog(dayIndex: number, text: string): ToggleResult {
        if (!session) return noop
        const result = session.saveLog(dayIndex, text)
        sync()
        return result
      },
      async attachImage(dayIndex: number, blob: Blob): Promise<ToggleResult> {
        if (!session) return noop
        const result = await session.attachImage(dayIndex, blob)
        sync()
        return result
      },
      attachLink(dayIndex: number, url: string): ToggleResult {
        if (!session) return noop
        const result = session.attachLink(dayIndex, url)
        sync()
        return result
      },
      async removeArtifact(dayIndex: number, artifactId: string): Promise<ToggleResult> {
        if (!session) return noop
        const result = await session.removeArtifact(dayIndex, artifactId)
        sync()
        return result
      },
      wouldReopen(dayIndex: number, artifactId: string): boolean {
        return session ? session.wouldReopen(dayIndex, artifactId) : false
      },
      changeDayBoundary(change: DayBoundary): BoundaryResult {
        if (!session) return { ok: false, reason: 'Still starting up. Try again in a moment.' }
        const result = session.changeDayBoundary(change)
        sync()
        return result
      },
      setReminder(time: string | null) {
        session?.setReminder(time)
        sync()
      },
      startChallenge(draft: ChallengeDraft): Challenge {
        if (!session) throw new Error('Storage is unavailable.')
        const c = session.start(draft)
        sync()
        return c
      },
      confirmReset() {
        session?.confirmReset()
        writeNotice(null)
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

  const dismissBanner = useCallback(() => {
    writeNotice(null)
    setBanner(null)
  }, [])

  // Stable while the day states and numbers are (see `keepDays` in sync).
  const derived = useMemo<Derived>(
    () => ({
      days: snap.days,
      currentIndex: snap.currentIndex,
      totalDays: snap.totalDays,
      streak: snap.streak,
      tally: snap.tally,
      checkInOpen: snap.checkInOpen,
    }),
    // streak and tally are rebuilt per snapshot; their numbers are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      snap.days,
      snap.currentIndex,
      snap.totalDays,
      snap.checkInOpen,
      snap.streak.current,
      snap.streak.longest,
      snap.tally.made,
      snap.tally.skipped,
      snap.tally.missed,
      snap.tally.logsWritten,
      snap.tally.artifactsKept,
    ],
  )

  // Stable unless something it carries changes, so a banner or a snapshot
  // update doesn't re-render every consumer for nothing.
  const value = useMemo<AppValue>(
    () => ({
      loading: loading || !authKnown,
      repo: repo as Repository,
      user: snap.user,
      challenge: snap.challenge,
      dayData: snap.dayData,
      derived,
      phase: snap.phase,
      resetMessage: snap.resetMessage,
      missedDay: snap.missedDay,
      creativeToday: snap.creativeToday,
      dayCloses: snap.dayCloses,
      stakes: snap.stakes,
      banner,
      dismissBanner,
      signIn,
      signInWithGoogle,
      supabaseEnabled: supabaseConfigured,
      signOut,
      ...actions,
    }),
    [loading, authKnown, repo, snap, derived, banner, dismissBanner, signIn, signInWithGoogle, signOut, actions],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
