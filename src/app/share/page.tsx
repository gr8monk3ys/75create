'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Grid, GridLegend } from '@/components/Grid'
import { StreakHeader } from '@/components/StreakHeader'
import { decodeSnapshot, ShareSnapshot } from '@/lib/shareSnapshot'
import { Day } from '@/lib/types'
import { MEDIUM_PHRASE, longDay } from '@/lib/format'

export default function SharePage() {
  const [snap, setSnap] = useState<ShareSnapshot | null | undefined>(undefined)

  useEffect(() => {
    // The snapshot lives in the URL fragment, which is never sent to the
    // server and is unreadable during render — decode it after mount, and
    // again whenever another link is opened in this tab.
    const read = () => {
      const fragment = window.location.hash.replace(/^#/, '')
      setSnap(fragment ? decodeSnapshot(fragment) : null)
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  if (snap === undefined) {
    return (
      <main className="share-view">
        <p className="status-line" role="status">
          Loading…
        </p>
      </main>
    )
  }

  if (!snap) {
    return (
      <main className="share-view centered">
        <h1 className="font-display sv-h1">This link is empty or broken.</h1>
        <p className="muted">Ask for a fresh share link, or start your own 75.</p>
        <Link href="/signin" className="btn">
          Start my 75
        </Link>
        <Styles />
      </main>
    )
  }

  // A snapshot, not a live view: the day that was open when it was shared
  // is drawn as still to come, never as a "today" that may be long past.
  const days: Day[] = snap.dayStates.map((state, i) => ({
    challengeId: 'shared',
    index: i + 1,
    state: state === 'today' ? 'future' : state,
    completedAt: null,
  }))
  // Older links carry no day index: the day after the last settled day is the
  // closest honest guess (a completed today is settled too).
  const settled = snap.dayStates.findLastIndex((s) => s !== 'future') + 1
  const dayIndex = snap.dayIndex ?? settled

  return (
    <main className="share-view">
      <nav className="sv-nav">
        <span className="wordmark font-display">75 Create</span>
        <Link href="/" className="btn btn-ghost small">
          Start your own
        </Link>
      </nav>

      <h1 className="font-display sv-h1">
        A {snap.dayStates.length}-day {MEDIUM_PHRASE[snap.medium] ?? 'creative'} challenge.
      </h1>
      <p className="sv-sub">
        {snap.takenAt
          ? `A snapshot from ${longDay(snap.takenAt)}${snap.takenAt.slice(0, 4) === String(new Date().getFullYear()) ? '' : ` ${snap.takenAt.slice(0, 4)}`}, read only. The owner chose to share it.`
          : 'Shared progress, read only. The owner chose to share this snapshot.'}
      </p>

      <div className="sv-head">
        <StreakHeader
          dayIndex={dayIndex}
          current={snap.current}
          longest={snap.longest}
          totalDays={snap.dayStates.length}
          readOnly
        />
      </div>

      <div className="grid-panel panel">
        {/* Someone who's never seen the app needs the key to the marks. */}
        <div className="sv-legend">
          <GridLegend days={days} />
        </div>
        <Grid days={days} />
      </div>

      {snap.includeLogs && Object.keys(snap.logs).length > 0 && (
        <section className="logs">
          <h2 className="font-display logs-h2">Daily logs</h2>
          <ol className="log-list">
            {Object.entries(snap.logs)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([idx, text]) => (
                <li key={idx} className="log-row">
                  <span className="log-day font-mono">Day {idx}</span>
                  <span className="log-text">{text}</span>
                </li>
              ))}
          </ol>
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
        padding: 1rem min(1.5rem, 5vw) 5rem;
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
      .share-view .sv-nav {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0 2rem;
      }
      .share-view .sv-nav .small {
        min-height: 44px;
        padding: 0.5rem 0.95rem;
        font-size: 0.75rem;
      }
      .share-view .sv-h1 {
        font-size: clamp(2rem, 6vw, 3rem);
        margin: 0.5rem 0 0.5rem;
        text-wrap: balance;
      }
      .share-view .sv-sub {
        margin: 0 0 1.75rem;
        color: var(--ink-soft);
      }
      .share-view .logs-h2 {
        font-size: 1.5rem;
        margin: 0;
      }
      .share-view .sv-legend {
        margin-bottom: 0.9rem;
      }
      .share-view .grid-panel {
        padding: 1.5rem;
      }
      .share-view .muted {
        color: var(--muted);
      }
      .share-view .logs {
        margin-top: 2.5rem;
      }
      .share-view .log-list {
        list-style: none;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      .share-view .log-row {
        display: grid;
        /* A day label that grows with the text, not a fixed column. */
        grid-template-columns: minmax(4.5rem, max-content) minmax(0, 1fr);
        gap: 0.75rem;
      }
      @media (max-width: 30em) {
        /* A phone (or large text): the day sits above its log. */
        .share-view .log-row {
          grid-template-columns: minmax(0, 1fr);
          gap: 0.2rem;
        }
      }
      .share-view .log-day {
        color: var(--muted);
        font-size: 0.8rem;
      }
      .share-view .log-text {
        color: var(--ink-soft);
        line-height: 1.5;
      }
    `}</style>
  )
}
