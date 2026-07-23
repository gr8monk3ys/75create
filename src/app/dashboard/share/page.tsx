'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/components/AppProvider'
import { encodeSnapshot, ShareSnapshot } from '@/lib/shareSnapshot'

export default function ShareGenerator() {
  const { loading, user, challenge, dayData, derived } = useApp()
  const router = useRouter()
  const [includeLogs, setIncludeLogs] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) router.replace('/signin')
    else if (!challenge) router.replace('/setup')
  }, [loading, user, challenge, router])

  const link = useMemo(() => {
    if (!challenge) return ''
    const logs: Record<number, string> = {}
    if (includeLogs) {
      for (const [idx, log] of Object.entries(dayData.logs)) {
        if (log.text) logs[Number(idx)] = log.text
      }
    }
    const snap: ShareSnapshot = {
      medium: challenge.medium,
      startDate: challenge.startDate,
      missPolicy: challenge.missPolicy,
      dayStates: derived.days.map((d) => d.state),
      current: derived.streak.current,
      longest: derived.streak.longest,
      includeLogs,
      logs,
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/share#${encodeSnapshot(snap)}`
  }, [challenge, dayData.logs, derived, includeLogs])

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — user can select manually */
    }
  }

  if (loading || !user || !challenge) return null

  return (
    <main className="share-gen">
      <nav className="sg-nav">
        <Link href="/dashboard" className="wordmark font-display brand">
          75 Create
        </Link>
        <Link href="/dashboard" className="font-mono back">
          ← back to grid
        </Link>
      </nav>

      <span className="eyebrow">Share your progress</span>
      <h1 className="font-display sg-h1">A read-only link to your grid.</h1>
      <p className="sg-sub">
        Anyone with the link sees your grid and streak — nothing else, no account
        needed. The link carries a snapshot from right now; generate a fresh one to
        update it.
      </p>

      <label className="toggle">
        <input
          type="checkbox"
          checked={includeLogs}
          onChange={(e) => setIncludeLogs(e.target.checked)}
        />
        <span>
          <span className="t-name">Include my daily logs</span>
          <span className="t-desc">
            Off by default. Your artifact images are never included in a share link.
          </span>
        </span>
      </label>

      <div className="link-box panel">
        <code className="link">{link}</code>
        <button className="btn" onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <a href={link} target="_blank" rel="noreferrer" className="preview-link font-mono">
        Preview the shared page →
      </a>

      <style jsx>{`
        .share-gen {
          max-width: 680px;
          padding-top: 1rem;
        }
        .sg-nav {
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
        .sg-h1 {
          font-size: clamp(2rem, 6vw, 2.8rem);
          margin: 0.5rem 0 0.75rem;
        }
        .sg-sub {
          color: var(--ink-soft);
          line-height: 1.55;
          margin: 0 0 2rem;
        }
        .toggle {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          padding: 1rem 1.25rem;
          border: 1.5px solid var(--line);
          border-radius: 12px;
          cursor: pointer;
          margin-bottom: 1.5rem;
        }
        .toggle input {
          margin-top: 0.25rem;
        }
        .t-name {
          display: block;
          font-weight: 600;
        }
        .t-desc {
          display: block;
          font-size: 0.82rem;
          color: var(--muted);
          margin-top: 0.2rem;
        }
        .link-box {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          padding: 0.75rem 0.75rem 0.75rem 1rem;
        }
        .link {
          flex: 1;
          font-family: var(--font-mono);
          font-size: 0.78rem;
          color: var(--ink-soft);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .preview-link {
          display: inline-block;
          margin-top: 1.25rem;
          font-size: 0.8rem;
          color: var(--cobalt);
          text-decoration: none;
        }
      `}</style>
    </main>
  )
}
