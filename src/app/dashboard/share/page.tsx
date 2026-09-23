'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
      dayIndex: derived.currentIndex,
      current: derived.streak.current,
      longest: derived.streak.longest,
      includeLogs,
      logs,
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/share#${encodeSnapshot(snap)}`
  }, [challenge, dayData.logs, derived, includeLogs])

  // One status node, always mounted, so assistive tech hears each change.
  // Cleared first, then filled on the next frame: the same message twice
  // is announced twice.
  const [status, setStatus] = useState('')
  const linkRef = useRef<HTMLTextAreaElement>(null)

  function say(message: string) {
    setStatus('')
    requestAnimationFrame(() => setStatus(message))
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      say('Link copied.')
      setTimeout(() => {
        setCopied(false)
        setStatus((s) => (s === 'Link copied.' ? '' : s))
      }, 1500)
    } catch {
      // No clipboard access (permissions, an old browser): select the link
      // so it's ready to copy by hand, and say so.
      linkRef.current?.focus()
      linkRef.current?.select()
      say('Couldn’t reach the clipboard. The link is selected above: copy it by hand.')
    }
  }

  if (loading || !user || !challenge) {
    return (
      <main>
        <p className="status-line" role="status">
          Loading…
        </p>
      </main>
    )
  }

  return (
    <main className="share-gen">
      <nav className="page-nav" aria-label="Main">
        <Link href="/dashboard" className="wordmark font-display brand">
          75 Create
        </Link>
        <Link href="/dashboard" className="back-link">
          Back to your grid
        </Link>
      </nav>

      <h1 className="font-display sg-h1">Share a read-only link to your grid.</h1>
      <p className="sg-sub">
        Anyone with the link sees your grid, streak and medium — nothing else, no account
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
        <label className="sr-only" htmlFor="share-link">
          Share link
        </label>
        <textarea
          ref={linkRef}
          id="share-link"
          className="link font-mono"
          readOnly
          rows={3}
          value={link}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button className="btn" onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <p className="copy-status" role="status">
        {status}
      </p>

      <a href={link} target="_blank" rel="noreferrer" className="preview-link font-mono">
        Preview the shared page
      </a>

      <style jsx>{`
        .share-gen {
          max-width: 680px;
          padding-top: 1rem;
        }
        .sg-h1 {
          font-size: clamp(2rem, 6vw, 3rem);
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
          border-radius: 14px;
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
          font-size: 0.8rem;
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
          min-width: 0;
          font-size: 0.8rem;
          line-height: 1.45;
          color: var(--ink-soft);
          background: transparent;
          border: 0;
          resize: none;
          word-break: break-all;
        }
        .copy-status {
          min-height: 1.4em;
          margin: 0.5rem 0 0;
          font-size: 0.875rem;
          color: var(--ink-soft);
        }
        .preview-link {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          margin-top: 0.75rem;
          font-size: 0.8rem;
          color: var(--cobalt);
          text-decoration: none;
        }
      `}</style>
    </main>
  )
}
