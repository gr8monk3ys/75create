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
import { DayData, Repository, newId, newUser } from '@/lib/repository'
import {
  BoundaryResult,
  ChallengeDraft,
  ChallengeSession,
  DayBoundary,
  PastAttempt,
  Phase,
  Snapshot,
  Stakes,
  Tally,
  ToggleResult,
  createChallengeSession,
  emptySnapshot,
} from '@/lib/challengeSession'
import { Challenge, Day, User } from '@/lib/types'

export type BannerKind = 'skip' | 'extend' | 'reset' | 'restore'

export interface Banner {
  kind: BannerKind
  message: string
  /** How many days the notice covers, for its title. */
  count?: number
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
  toggleRule: (dayIndex: number, ruleId: string) => ToggleResult
  saveLog: (dayIndex: number, text: string) => ToggleResult
  attachImage: (dayIndex: number, blob: Blob) => Promise<ToggleResult>
  attachLink: (dayIndex: number, url: string) => ToggleResult
  removeArtifact: (dayIndex: number, artifactId: string) => Promise<ToggleResult>
  wouldReopen: (dayIndex: number, artifactId: string) => boolean
  startChallenge: (draft: ChallengeDraft) => Challenge
  confirmReset: () => void
  enterMaintenance: () => void
  closeForNewRound: () => void
  endAttempt: () => void
  /** Past attempts and finished rounds, newest first (read on demand). */
  history: () => PastAttempt[]
}

const AppContext = createContext<AppValue | null>(null)

const EMPTY: Snapshot = emptySnapshot()

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

function sameStakes(a: Stakes | null, b: Stakes | null): boolean {
  if (!a || !b) return a === b
  return a.policy === b.policy && a.tokensLeft === b.tokensLeft && a.extraDays === b.extraDays
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
    // The day states and stakes only change at rollover or completion, not
    // on every autosave: keep the previous values while they're equal, so
    // the memoized grids and header don't re-render while someone types.
    setSnap((prev) => ({
      ...snapshot,
      days: sameDays(prev.days, snapshot.days) ? prev.days : snapshot.days,
      stakes: sameStakes(prev.stakes, snapshot.stakes) ? prev.stakes : snapshot.stakes,
    }))
    const last = events[events.length - 1]
    if (last) {
      const notice: Banner = { kind: last.kind, message: last.message, count: last.days.length }
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
    // With a backend, the first sync waits for the auth listener, which pulls
    // this account's rows first: rolling over on the local copy alone could
    // action a day as missed that another device already made.
    if (supabaseConfigured) return
    // Hydration from localStorage/IndexedDB, which are unreadable during
    // render and on the server — an effect is the only place this can happen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    sync()
  }, [sync])

  // The creative day changes while a tab stays open or a PWA sits in the
  // background. Re-sync when it does, so today's check-in never writes to
  // yesterday and a missed day is actioned as soon as it becomes one.
  useEffect(() => {
    if (!session || !authKnown) return
    const synced = supabase ? (repo as SyncedRepository) : null
    let pulling = false
    // Before deciding anything about the day, catch up with the other
    // devices (bounded, and a no-op offline).
    const catchUp = async () => {
      if (!synced || pulling) return sync()
      pulling = true
      try {
        await synced.pull()
      } finally {
        pulling = false
      }
      sync()
    }
    const onChange = () => {
      if (session.read().creativeToday !== snap.creativeToday) void catchUp()
    }
    const timer = setInterval(onChange, TICK_MS)
    // Back in the foreground: another tab or device may have written since,
    // and a tick must toggle what's stored, not what this tab last drew.
    const onReturn = () => {
      if (document.visibilityState === 'visible') void catchUp()
    }
    // Another tab on this device wrote: re-read at once.
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith('75create.')) sync()
    }
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    window.addEventListener('storage', onStorage)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
      window.removeEventListener('storage', onStorage)
    }
  }, [session, authKnown, supabase, repo, snap.creativeToday, sync])

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
      else if (current.email.toLowerCase() !== email.toLowerCase()) {
        const known = repo.parkedUsers().find((u) => u.email.toLowerCase() === email.toLowerCase())
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
    const refused: ToggleResult = { ok: false }
    /**
     * Every write: run it on the session, then re-read so the UI catches up
     * (a refused write means the day moved on under the user; the snapshot
     * catches up either way). `fallback` answers while storage is starting.
     */
    function write<A extends unknown[], R>(
      run: (s: ChallengeSession, ...args: A) => R,
      fallback: R,
    ): (...args: A) => R {
      return (...args: A): R => {
        if (!session) return fallback
        const result = run(session, ...args)
        if (result instanceof Promise) {
          return result.then((value) => {
            sync()
            return value
          }) as R
        }
        sync()
        return result
      }
    }
    return {
      toggleRule: write((s, day: number, ruleId: string) => s.toggleRule(day, ruleId), refused),
      saveLog: write((s, day: number, text: string) => s.saveLog(day, text), refused),
      attachImage: write((s, day: number, blob: Blob) => s.attachImage(day, blob), Promise.resolve(refused)),
      attachLink: write((s, day: number, url: string) => s.attachLink(day, url), refused),
      removeArtifact: write(
        (s, day: number, id: string) => s.removeArtifact(day, id),
        Promise.resolve(refused),
      ),
      wouldReopen: (day: number, id: string) => session?.wouldReopen(day, id) ?? false,
      changeDayBoundary: write((s, change: DayBoundary) => s.changeDayBoundary(change), {
        ok: false,
        reason: 'Still starting up. Try again in a moment.',
      } as BoundaryResult),
      setReminder: write((s, time: string | null) => s.setReminder(time), undefined),
      startChallenge(draft: ChallengeDraft): Challenge {
        // No fallback here: starting without storage must fail loudly.
        if (!session) throw new Error('Storage is unavailable.')
        const challenge = session.start(draft)
        // 75 days of work lives in this browser: ask it not to evict the
        // storage under pressure (granted silently for installed PWAs).
        void navigator.storage?.persist?.().catch(() => false)
        sync()
        return challenge
      },
      confirmReset: write((s) => {
        s.confirmReset()
        writeNotice(null)
        setBanner(null)
      }, undefined),
      enterMaintenance: write((s) => s.enterMaintenance(), undefined),
      closeForNewRound: write((s) => s.closeForNewRound(), undefined),
      endAttempt: write((s) => {
        s.endAttempt()
        writeNotice(null)
        setBanner(null)
      }, undefined),
      history: () => session?.history() ?? [],
    }
  }, [session, sync])

  const dismissBanner = useCallback(() => {
    writeNotice(null)
    setBanner(null)
  }, [])

  // Stable while the day states and numbers are (sync keeps equal `days`
  // and `stakes` objects from one snapshot to the next).
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
