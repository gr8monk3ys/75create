'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/components/AppProvider'
import { buildExport } from '@/lib/export'
import type { User } from '@/lib/types'
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
  const router = useRouter()
  const [reminderOn, setReminderOn] = useState(user.reminderTime !== null)
  const [reminderTime, setReminderTime] = useState(user.reminderTime ?? '20:00')
  const [buffer, setBuffer] = useState(user.lateNightBufferHrs)
  const [permission, setPermission] = useState<string>(() =>
    typeof Notification === 'undefined' ? 'default' : Notification.permission,
  )
  const [exporting, setExporting] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  async function saveReminders(on: boolean, time: string) {
    if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const p = await Notification.requestPermission()
      setPermission(p)
    }
    repo.saveUser({ ...user, reminderTime: on ? time : null })
    refresh()
  }

  function saveBuffer(hrs: number) {
    setBuffer(hrs)
    repo.saveUser({ ...user, lateNightBufferHrs: hrs })
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
    router.push('/')
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
        <p className="note font-mono">
          {supabaseEnabled
            ? 'Browser notifications fire on this device while the app is open. Email reminders are sent by the server at your reminder time (when the reminder function is deployed).'
            : 'Prototype note: email reminders need a server backend. For now this fires a browser notification on this device.'}
        </p>
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

      <button className="btn btn-ghost signout" onClick={() => { signOut(); router.push('/') }}>
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
