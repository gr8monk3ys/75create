'use client'

import { useEffect, useState } from 'react'
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
import { supabase } from '@/lib/supabase'
import { downloadBlob } from '@/lib/certificate'

export default function Settings() {
  const { loading, user } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/signin')
  }, [loading, user, router])

  if (loading || !user) return null
  // Keyed on the user so the form seeds its fields from stored preferences
  // once, instead of copying them in through an effect on every render.
  return <SettingsForm key={user.id} user={user} />
}

function SettingsForm({ user }: { user: User }) {
  const { repo, refresh, signOut, supabaseEnabled } = useApp()
  const [reminderOn, setReminderOn] = useState(user.reminderTime !== null)
  const [reminderTime, setReminderTime] = useState(user.reminderTime ?? '20:00')
  const [buffer, setBuffer] = useState(user.lateNightBufferHrs)
  const [permission, setPermission] = useState<string>(() =>
    typeof Notification === 'undefined' ? 'default' : Notification.permission,
  )
  const [exporting, setExporting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
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
    repo.saveUser({ ...user, reminderTime: on ? time : null })
    refresh()

    // Push first where it's available: it's the only reminder that reaches a
    // phone with the app closed, and the only one that works on iOS at all.
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
    setBuffer(hrs)
    repo.saveUser({ ...user, lateNightBufferHrs: hrs })
    refresh()
  }

  function saveTz(tz: string) {
    repo.saveUser({ ...user, tz })
    refresh()
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
      <nav className="set-nav">
        <Link href="/dashboard" className="wordmark font-display brand">
          75 Create
        </Link>
        <Link href="/dashboard" className="font-mono back">
          ← back to grid
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
            <input
              type="time"
              value={reminderTime}
              className="time"
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
          Your day rolls over here. It follows this device automatically — change
          it only if you want your challenge pinned to somewhere else.
        </p>
        <div className="tz-row">
          <span className="tz-current font-mono">{user.tz}</span>
          {deviceTz && deviceTz !== user.tz && (
            <button className="btn btn-ghost small" onClick={() => saveTz(deviceTz)}>
              Use {deviceTz}
            </button>
          )}
        </div>
      </section>

      <section className="block panel">
        <h2 className="font-display block-h2">Late-night buffer</h2>
        <p className="block-sub">
          How many hours past midnight still counts as “today” — for when you create
          after 12.
        </p>
        <div className="chips">
          {[0, 2, 3, 4, 6].map((h) => (
            <button
              key={h}
              className={`chip ${buffer === h ? 'sel' : ''}`}
              onClick={() => saveBuffer(h)}
            >
              {h === 0 ? 'Midnight' : `${h}am`}
            </button>
          ))}
        </div>
      </section>

      <section className="block panel">
        <h2 className="font-display block-h2">Export your data</h2>
        <p className="block-sub">
          Everything you’ve logged and every artifact image, as a ZIP with JSON and
          CSV. Yours to keep.
        </p>
        <button className="btn btn-ghost" onClick={doExport} disabled={exporting}>
          {exporting ? 'Packaging…' : 'Download export (.zip)'}
        </button>
      </section>

      <section className="block panel danger">
        <h2 className="font-display block-h2">Delete account</h2>
        <p className="block-sub">
          Immediate and permanent. Wipes every challenge, log, and artifact on this
          device. Export first if you want a copy.
        </p>
        <div className="del-row">
          <input
            className="del-input"
            placeholder="Type DELETE to confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
          <button
            className="btn del-btn"
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
        .set-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0 2.5rem;
        }
        .brand {
          font-size: 1.25rem;
          text-decoration: none;
        }
        .back {
          font-size: 0.78rem;
          color: var(--ink-soft);
          text-decoration: none;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .set-h1 {
          font-size: 2.5rem;
          margin: 0 0 0.4rem;
        }
        .account {
          color: var(--muted);
          font-size: 0.8rem;
          margin: 0 0 2rem;
        }
        .block {
          padding: 1.5rem;
          margin-bottom: 1.25rem;
        }
        .block-h2 {
          font-size: 1.35rem;
          margin: 0 0 0.75rem;
        }
        .block-sub {
          color: var(--ink-soft);
          line-height: 1.5;
          margin: 0 0 1.1rem;
        }
        .row-toggle {
          display: flex;
          align-items: center;
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
          font-family: var(--font-body);
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          border: 1.5px solid var(--line);
          background: var(--paper);
          color: var(--ink);
        }
        .hint {
          font-size: 0.72rem;
          color: var(--muted);
        }
        .note {
          font-size: 0.7rem;
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
          font-size: 0.85rem;
          color: var(--ink);
          background: var(--paper-3);
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
        }
        .small {
          padding: 0.6rem 1rem;
          min-height: 44px;
          font-size: 0.7rem;
        }
        .chips {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .chip {
          padding: 0.55rem 1rem;
          border-radius: 999px;
          border: 1.5px solid var(--line);
          background: var(--paper);
          color: var(--ink);
          cursor: pointer;
          font-family: var(--font-mono);
          font-size: 0.8rem;
        }
        .chip.sel {
          border-color: var(--cobalt);
          background: color-mix(in srgb, var(--cobalt) 12%, var(--paper));
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
          min-width: 180px;
          font-family: var(--font-mono);
          font-size: 0.85rem;
          padding: 0.7rem 0.9rem;
          border-radius: 8px;
          border: 1.5px solid var(--line);
          background: var(--paper);
          color: var(--ink);
        }
        .del-btn {
          background: var(--coral);
          border-color: var(--coral);
        }
        .del-btn:hover:not(:disabled) {
          box-shadow: 4px 6px 0 var(--ink);
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
