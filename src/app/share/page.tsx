'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Grid } from '@/components/Grid'
import { StreakHeader } from '@/components/StreakHeader'
import { decodeSnapshot, ShareSnapshot } from '@/lib/shareSnapshot'
import { Day } from '@/lib/types'

export default function SharePage() {
  const [snap, setSnap] = useState<ShareSnapshot | null | undefined>(undefined)

  useEffect(() => {
    const fragment = window.location.hash.replace(/^#/, '')
    setSnap(fragment ? decodeSnapshot(fragment) : null)
  }, [])

  if (snap === undefined) {
    return (
      <main className="share-view">
        <p className="font-mono muted">Loading…</p>
      </main>
    )
  }

  if (!snap) {
    return (
      <main className="share-view centered">
        <h1 className="font-display">This link is empty or broken.</h1>
        <p className="muted">Ask for a fresh share link, or start your own 75.</p>
        <Link href="/" className="btn">
          Start my 75
        </Link>
        <Styles />
      </main>
    )
  }

  const days: Day[] = snap.dayStates.map((state, i) => ({
    challengeId: 'shared',
    index: i + 1,
    state,
    completedAt: null,
  }))
  const completed = snap.dayStates.filter((s) => s === 'complete').length
  const dayIndex = snap.dayStates.findIndex((s) => s === 'today') + 1

  return (
    <main className="share-view">
      <nav className="sv-nav">
        <span className="wordmark font-display">75 Create</span>
        <Link href="/" className="btn btn-ghost small">
          Start your own
        </Link>
      </nav>

      <span className="eyebrow">Shared progress · read only</span>
      <h1 className="font-display sv-h1">
        A 75-day {snap.medium} challenge.
      </h1>

      <div className="sv-head">
        <StreakHeader
          dayIndex={dayIndex > 0 ? dayIndex : completed}
          current={snap.current}
          longest={snap.longest}
          totalDays={snap.dayStates.length}
        />
      </div>

      <div className="grid-panel panel">
        <Grid days={days} />
      </div>

      {snap.includeLogs && Object.keys(snap.logs).length > 0 && (
        <section className="logs">
          <span className="eyebrow">Daily logs</span>
          <div className="log-list">
            {Object.entries(snap.logs)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([idx, text]) => (
                <div key={idx} className="log-row">
                  <span className="log-day font-mono">Day {idx}</span>
                  <span className="log-text">{text}</span>
                </div>
              ))}
          </div>
        </section>
      )}

      <Styles />
    </main>
  )
}

function Styles() {
  return (
    <style jsx global>{`
      .share-view {
        max-width: 820px;
        margin: 0 auto;
        padding: 1rem 1.5rem 5rem;
      }
      .share-view.centered {
        min-height: 80dvh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        text-align: center;
      }
      .sv-nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0 2rem;
      }
      .sv-nav .small {
        padding: 0.5rem 0.9rem;
        font-size: 0.7rem;
      }
      .sv-h1 {
        font-size: clamp(2rem, 6vw, 3rem);
        margin: 0.5rem 0 1.75rem;
      }
      .grid-panel {
        padding: 1.5rem;
      }
      .muted {
        color: var(--muted);
      }
      .logs {
        margin-top: 2.5rem;
      }
      .log-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      .log-row {
        display: grid;
        grid-template-columns: 70px 1fr;
        gap: 0.75rem;
      }
      .log-day {
        color: var(--muted);
        font-size: 0.72rem;
      }
      .log-text {
        color: var(--ink-soft);
        line-height: 1.5;
      }
    `}</style>
  )
}
