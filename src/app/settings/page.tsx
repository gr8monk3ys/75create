'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/components/AppProvider'
import { buildExport } from '@/lib/export'
import type { User } from '@/lib/types'
import { detectTimezone } from '@/lib/timezone'
import {
  getPushStatus,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus,
} from '@/lib/push'
import { downloadBlob } from '@/lib/certificate'

export default function Settings() {
  const { loading, user } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/signin')
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <main className="settings">
        <p className="status-line" role="status">
          Loading settings…
        </p>
      </main>
    )
  }
  // Keyed on the user so the form seeds its fields from stored preferences
  // once, instead of copying them in through an effect on every render.
  return <SettingsForm key={user.id} user={user} />
}

/**
 * The way out, stated plainly. Before Day 1 it's a free redo of the setup;
 * mid-attempt it's quitting, which the format allows but never hides: the
 * attempt ends where it is and moves to past attempts with everything made.
 */
function EndChallenge() {
  const { challenge, phase, derived, missedDay, endAttempt } = useApp()
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (armed) confirmRef.current?.focus()
  }, [armed])

  if (!challenge || (phase !== 'prestart' && phase !== 'active' && phase !== 'reset-pending')) {
    return null
  }
  const endsOn = phase === 'reset-pending' ? missedDay : derived.currentIndex

  function end() {
    endAttempt()
    router.push('/setup')
  }

  return (
    <section className="block panel" aria-labelledby="end-title">
      <h2 className="font-display block-h2" id="end-title">
        {phase === 'prestart' ? 'Change your setup' : 'End this challenge'}
      </h2>
      <p className="block-sub">
        {phase === 'prestart'
          ? 'Day 1 hasn’t started, so nothing is lost: set it up again with different rules, stakes or a start date.'
          : `This attempt ends on Day ${endsOn} and moves to past attempts with everything you made. Then you set up a new challenge.`}
      </p>
      {armed ? (
        <div className="end-row">
          <button ref={confirmRef} type="button" className="btn btn-danger" onClick={end}>
            {phase === 'prestart' ? 'Yes, set it up again' : `Yes, end on Day ${endsOn}`}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setArmed(false)}>
            Keep going
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={() => setArmed(true)}>
          {phase === 'prestart' ? 'Set it up again' : 'End this challenge'}
        </button>
      )}
      <style jsx>{`
        .end-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
        }
      `}</style>
    </section>
  )
}

function SettingsForm({ user }: { user: User }) {
  const { repo, signOut, supabaseEnabled, changeDayBoundary, setReminder } = useApp()
  const [reminderOn, setReminderOn] = useState(user.reminderTime !== null)
  const [reminderTime, setReminderTime] = useState(user.reminderTime ?? '20:00')
  const [buffer, setBuffer] = useState(user.lateNightBufferHrs)
  const [permission, setPermission] = useState<string>(() =>
    typeof Notification === 'undefined' ? 'default' : Notification.permission,
  )
  const [exporting, setExporting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  // Why a day-boundary change was refused, shown under the control that asked.
  // `n` re-keys the note, so pressing a refused choice again is announced again.
  const [boundaryNote, setBoundaryNote] = useState<{ on: 'tz' | 'buffer'; text: string; n: number } | null>(
    null,
  )
  const deviceTz = detectTimezone()
  const [pushStatus, setPushStatus] = useState<PushStatus>('unsupported')

  useEffect(() => {
    // Reading the current subscription is async and prompts for nothing.
    let cancelled = false
    void getPushStatus().then((s) => {
      if (!cancelled) setPushStatus(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function saveReminders(on: boolean, time: string) {
    setReminder(on ? time : null)

    // Push first where it's available: it's the only reminder that reaches a
    // phone with the app closed, and the only one that works on iOS at all.
    // The SDK only exists in builds with a backend; fetch it on demand.
    const supabase = supabaseEnabled ? (await import('@/lib/supabase')).supabase : null
    if (isPushSupported() && supabase) {
      const status = on
        ? await subscribeToPush(supabase, user.id)
        : (await unsubscribeFromPush(supabase), 'unsubscribed' as const)
      setPushStatus(status)
      setPermission(
        typeof Notification === 'undefined' ? 'default' : Notification.permission,
      )
      return
    }

    if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const p = await Notification.requestPermission()
      setPermission(p)
    }
  }

  function saveBuffer(hrs: number) {
    const result = changeDayBoundary({ lateNightBufferHrs: hrs })
    if (result.ok) setBuffer(hrs)
    setBoundaryNote((prev) => (result.ok ? null : { on: 'buffer', text: result.reason, n: (prev?.n ?? 0) + 1 }))
  }

  function saveTz(tz: string) {
    const result = changeDayBoundary({ tz })
    setBoundaryNote((prev) => (result.ok ? null : { on: 'tz', text: result.reason, n: (prev?.n ?? 0) + 1 }))
  }

  async function doExport() {
    setExporting(true)
    try {
      const blob = await buildExport(repo)
      downloadBlob(blob, '75-create-export.zip')
    } finally {
      setExporting(false)
    }
  }

  async function deleteAccount() {
    if (confirmText !== 'DELETE') return
    await repo.deleteAllData()
    signOut()
    // A hard navigation, not router.push: signing out re-runs the signed-out
    // redirect on this page, which raced the push and could land the user on
    // /signin instead. It also guarantees no wiped state survives in memory.
    window.location.replace('/')
  }

  return (
    <main className="settings">
      <nav className="page-nav" aria-label="Main">
        <Link href="/dashboard" className="wordmark font-display brand">
          75 Create
        </Link>
        <Link href="/dashboard" className="back-link">
          Back to your grid
        </Link>
      </nav>

      <h1 className="font-display set-h1">Settings</h1>
      <p className="account font-mono">Signed in as {user.email}</p>

      <section className="block panel">
        <h2 className="font-display block-h2">Daily reminder</h2>
        <label className="row-toggle">
          <input
            type="checkbox"
            checked={reminderOn}
            onChange={(e) => {
              setReminderOn(e.target.checked)
              saveReminders(e.target.checked, reminderTime)
            }}
          />
          <span>Remind me to check in</span>
        </label>
        {reminderOn && (
          <div className="time-row">
            <label className="sr-only" htmlFor="reminder-time">
              Reminder time
            </label>
            <input
              id="reminder-time"
              type="time"
              value={reminderTime}
              className="field-input time"
              onChange={(e) => {
                setReminderTime(e.target.value)
                saveReminders(true, e.target.value)
              }}
            />
            <span className="hint font-mono">
              {permission === 'denied'
                ? 'Notifications are blocked in your browser settings.'
                : 'Uses browser notifications on this device.'}
            </span>
          </div>
        )}
        <p className="note font-mono">{reminderChannelNote(supabaseEnabled, pushStatus)}</p>
      </section>

      <section className="block panel">
        <h2 className="font-display block-h2">Time zone</h2>
        <p className="block-sub">
          Your day rolls over in this time zone. It was set from this device when
          you signed up; if you travel or move, switch it here.
        </p>
        <div className="tz-row">
          <span className="tz-current font-mono">{user.tz}</span>
          {deviceTz && deviceTz !== user.tz && (
            <button className="btn btn-ghost small" onClick={() => saveTz(deviceTz)}>
              Use {deviceTz}
            </button>
          )}
        </div>
        {boundaryNote?.on === 'tz' && (
          <p className="refused" role="alert" key={boundaryNote.n}>
            {boundaryNote.text}
          </p>
        )}
      </section>

      <section className="block panel">
        <h2 className="font-display block-h2" id="buffer-title">
          Late-night buffer
        </h2>
        <p className="block-sub">
          How many hours past midnight still counts as “today” — for when you create
          after 12.
        </p>
        <div className="chips" role="group" aria-labelledby="buffer-title">
          {[0, 2, 3, 4, 6].map((h) => (
            <button
              key={h}
              type="button"
              className={`chip ${buffer === h ? 'sel' : ''}`}
              aria-pressed={buffer === h}
              onClick={() => saveBuffer(h)}
            >
              {h === 0 ? 'Midnight' : `${h}am`}
            </button>
          ))}
        </div>
        {boundaryNote?.on === 'buffer' && (
          <p className="refused" role="alert" key={boundaryNote.n}>
            {boundaryNote.text}
          </p>
        )}
      </section>

      <EndChallenge />

      <section className="block panel">
        <h2 className="font-display block-h2">Export your data</h2>
        <p className="block-sub">
          Everything you’ve logged and every artifact image, as a ZIP with JSON and
          CSV. Yours to keep.
        </p>
        <button
          className="btn btn-ghost"
          onClick={() => !exporting && doExport()}
          aria-disabled={exporting}
          aria-busy={exporting}
        >
          {exporting ? 'Packaging…' : 'Download export (.zip)'}
        </button>
      </section>

      <section className="block panel danger">
        <h2 className="font-display block-h2">Delete account</h2>
        <p className="block-sub">
          Immediate and permanent. Wipes every challenge, log, and artifact on this
          device. Export first if you want a copy.
        </p>
        {/* A visible label: the instruction mustn't vanish as you type, on
            the one action that can't be undone. */}
        <label className="field-label" htmlFor="delete-confirm">
          Type DELETE to confirm
        </label>
        <div className="del-row">
          <input
            id="delete-confirm"
            className="field-input del-input"
            placeholder="DELETE"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
          <button
            className="btn btn-danger del-btn"
            onClick={deleteAccount}
            disabled={confirmText !== 'DELETE'}
          >
            Delete everything
          </button>
        </div>
      </section>

      <button
        className="btn btn-ghost signout"
        onClick={() => {
          signOut()
          // Same race as deletion: signing out triggers this page's
          // signed-out redirect, so leave with a hard navigation.
          window.location.replace('/')
        }}
      >
        Sign out
      </button>

      <style jsx>{`
        .settings {
          max-width: 640px;
          padding-top: 1rem;
        }
        .set-h1 {
          font-size: clamp(2rem, 6vw, 3rem);
          margin: 0 0 0.4rem;
        }
        .account {
          color: var(--muted);
          font-size: 0.8rem;
          margin: 0 0 2rem;
        }
        .settings :global(.block) {
          /* Held to the viewport on a phone, so large text keeps its width
             (the reminder time keeps its AM/PM). */
          padding: min(1.5rem, 5vw);
          margin-bottom: 1.25rem;
        }
        .settings :global(.block-h2) {
          font-size: 1.25rem;
          margin: 0 0 0.75rem;
        }
        .settings :global(.block-sub) {
          color: var(--ink-soft);
          line-height: 1.5;
          margin: 0 0 1.1rem;
        }
        .refused {
          margin: 0.9rem 0 0;
          max-width: 60ch;
          font-size: 0.875rem;
          line-height: 1.5;
          color: var(--coral-ink);
        }
        .row-toggle {
          display: flex;
          align-items: center;
          min-height: 44px;
          gap: 0.6rem;
          cursor: pointer;
          font-weight: 600;
        }
        .time-row {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          margin-top: 1rem;
          flex-wrap: wrap;
        }
        .time {
          width: auto;
        }
        .hint {
          font-size: 0.8rem;
          color: var(--muted);
        }
        .note {
          font-size: 0.8rem;
          color: var(--muted);
          margin: 1.1rem 0 0;
          border-top: 1.5px dashed var(--line);
          padding-top: 0.9rem;
          line-height: 1.5;
        }
        .tz-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .tz-current {
          font-size: 0.875rem;
          color: var(--ink);
          background: var(--paper-3);
          border-radius: 10px;
          padding: 0.5rem 0.75rem;
        }
        .chips {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .danger {
          border-color: color-mix(in srgb, var(--coral) 45%, var(--line));
        }
        .del-row {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
        }
        .del-input {
          flex: 1;
          min-width: min(100%, 180px);
          width: auto;
          font-family: var(--font-mono);
        }
        .signout {
          margin-top: 1rem;
        }
      `}</style>
    </main>
  )
}

/** Say plainly which reminder channel this device will actually get. */
function reminderChannelNote(supabaseEnabled: boolean, pushStatus: PushStatus): string {
  if (pushStatus === 'subscribed') {
    return 'Push notifications are on for this device — they arrive even with the app closed.'
  }
  if (pushStatus === 'denied') {
    return 'Notifications are blocked for this site in your browser or system settings. Re-allow them there to get reminders.'
  }
  if (supabaseEnabled) {
    return 'This device gets a browser notification while the app is open. Email reminders are sent by the server at your reminder time, when that function is deployed.'
  }
  return 'Prototype note: email and push reminders need the server backend. For now this fires a browser notification on this device, and only while the app is open.'
}
