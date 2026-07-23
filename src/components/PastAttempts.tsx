'use client'

import { useState } from 'react'
import { useApp } from './AppProvider'
import { Challenge } from '@/lib/types'

export function PastAttempts() {
  const { repo } = useApp()
  const archived = repo
    .getChallenges()
    .filter((c) => c.status === 'archived')
  const [open, setOpen] = useState<string | null>(null)

  if (archived.length === 0) return null

  return (
    <section className="past">
      <span className="eyebrow">Past attempts</span>
      <h2 className="font-display past-h2">Nothing here is deleted.</h2>
      <p className="past-sub">
        Every reset archives the attempt, logs and all. It still counts as work you
        made.
      </p>
      <div className="attempts">
        {archived.map((c) => (
          <AttemptRow
            key={c.id}
            challenge={c}
            open={open === c.id}
            onToggle={() => setOpen(open === c.id ? null : c.id)}
          />
        ))}
      </div>

      <style jsx>{`
        .past {
          margin-top: 3.5rem;
          border-top: 1.5px solid var(--line);
          padding-top: 2.5rem;
        }
        .past-h2 {
          font-size: 1.6rem;
          margin: 0.4rem 0 0.5rem;
        }
        .past-sub {
          color: var(--ink-soft);
          margin: 0 0 1.5rem;
          max-width: 48ch;
          line-height: 1.5;
        }
        .attempts {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
      `}</style>
    </section>
  )
}

function AttemptRow({
  challenge,
  open,
  onToggle,
}: {
  challenge: Challenge
  open: boolean
  onToggle: () => void
}) {
  const { repo } = useApp()
  const dd = repo.getDayData(challenge.id)
  const completed = Object.keys(dd.completions).length
  const logs = Object.entries(dd.logs).sort((a, b) => Number(a[0]) - Number(b[0]))

  return (
    <div className="attempt panel">
      <button className="attempt-head" onClick={onToggle} aria-expanded={open}>
        <div>
          <span className="a-medium font-mono">{challenge.medium}</span>
          <span className="a-meta">
            started {challenge.startDate} · {challenge.missPolicy} · reached day{' '}
            {completed}
          </span>
        </div>
        <span className="chev">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="attempt-body">
          {logs.length === 0 ? (
            <p className="empty font-mono">No logs recorded in this attempt.</p>
          ) : (
            <ul className="log-list">
              {logs.map(([idx, log]) => (
                <li key={idx}>
                  <span className="log-day font-mono">Day {idx}</span>
                  <span className="log-text">{log.text || '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <style jsx>{`
        .attempt {
          overflow: hidden;
        }
        .attempt-head {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--ink);
          text-align: left;
          gap: 1rem;
        }
        .a-medium {
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-size: 0.75rem;
          color: var(--coral);
          margin-right: 0.75rem;
        }
        .a-meta {
          color: var(--muted);
          font-size: 0.85rem;
        }
        .chev {
          font-size: 1.2rem;
          color: var(--muted);
        }
        .attempt-body {
          padding: 0 1.25rem 1.25rem;
          border-top: 1.5px solid var(--line);
        }
        .empty {
          color: var(--muted);
          font-size: 0.8rem;
        }
        .log-list {
          list-style: none;
          padding: 0;
          margin: 1rem 0 0;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .log-list li {
          display: grid;
          grid-template-columns: 70px 1fr;
          gap: 0.75rem;
          font-size: 0.9rem;
        }
        .log-day {
          color: var(--muted);
          font-size: 0.72rem;
        }
        .log-text {
          color: var(--ink-soft);
          line-height: 1.4;
        }
      `}</style>
    </div>
  )
}
