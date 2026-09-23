'use client'

import { useMemo, useState } from 'react'
import { useApp } from './AppProvider'
import { Grid } from './Grid'
import { Icon } from './Icon'
import { attemptDays, tally } from '@/lib/challengeSession'
import { POLICY_NAMES, shortDate } from '@/lib/format'
import { Challenge } from '@/lib/types'
import type { DayData } from '@/lib/repository'

export function PastAttempts() {
  const { repo, challenge } = useApp()
  // Archived attempts only change when an attempt ends (a new challenge id),
  // so they're read from storage then, not on every autosave.
  const activeId = challenge?.id
  const archived = useMemo(
    () =>
      repo
        .getChallenges()
        .filter((c) => c.status === 'archived')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((c) => ({ challenge: c, dayData: repo.getDayData(c.id) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repo, activeId],
  )
  const [open, setOpen] = useState<string | null>(null)

  if (archived.length === 0) return null

  return (
    <section className="past" aria-labelledby="past-title">
      <h2 id="past-title" className="font-display past-h2">
        Past attempts
      </h2>
      <p className="past-sub">
        Nothing here is deleted. Every reset archives the attempt, logs and all. It still counts
        as work you made.
      </p>
      <ul className="attempts">
        {archived.map(({ challenge: c, dayData }, i) => (
          <AttemptRow
            key={c.id}
            number={archived.length - i}
            challenge={c}
            dayData={dayData}
            open={open === c.id}
            onToggle={() => setOpen(open === c.id ? null : c.id)}
          />
        ))}
      </ul>

      <style jsx>{`
        .past {
          margin-top: 3.5rem;
          border-top: 1.5px solid var(--line);
          padding-top: 2.5rem;
        }
        .past-h2 {
          font-size: 1.5rem;
          margin: 0 0 0.5rem;
        }
        .past-sub {
          color: var(--ink-soft);
          margin: 0 0 1.5rem;
          max-width: 52ch;
          line-height: 1.5;
        }
        .attempts {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
      `}</style>
    </section>
  )
}

function AttemptRow({
  number,
  challenge,
  dayData: dd,
  open,
  onToggle,
}: {
  number: number
  challenge: Challenge
  dayData: DayData
  open: boolean
  onToggle: () => void
}) {
  const days = attemptDays(challenge, dd)
  const { made } = tally(days, dd)
  const endedOn = challenge.endedOnDay ?? days.find((d) => d.state === 'missed')?.index ?? null
  const logs = Object.entries(dd.logs)
    .filter(([, log]) => log.text.trim())
    .sort((a, b) => Number(a[0]) - Number(b[0]))
  const bodyId = `attempt-${challenge.id}`

  return (
    <li className="attempt panel">
      <button className="attempt-head" onClick={onToggle} aria-expanded={open} aria-controls={bodyId}>
        <span className="a-title">
          <span className="a-name font-display">Attempt {number}</span>
          <span className="a-meta">
            {POLICY_NAMES[challenge.missPolicy]} · started {shortDate(challenge.startDate)} ·{' '}
            {made} {made === 1 ? 'day' : 'days'} made
            {challenge.endedOnDay ? ` · ended on Day ${challenge.endedOnDay}` : ''}
          </span>
        </span>
        <Icon name={open ? 'minus' : 'plus'} size={20} className="chev" />
      </button>
      {open && (
        <div className="attempt-body" id={bodyId}>
          <div className="a-grid">
            <Grid days={days} compact endedOn={endedOn} />
          </div>
          {logs.length === 0 ? (
            <p className="empty">No logs were written in this attempt.</p>
          ) : (
            <ol className="log-list">
              {logs.map(([idx, log]) => (
                <li key={idx}>
                  <span className="log-day">Day {idx}</span>
                  <span className="log-text">{log.text}</span>
                </li>
              ))}
            </ol>
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
          min-height: 56px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--ink);
          text-align: left;
          gap: 1rem;
        }
        .a-title {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .a-name {
          font-size: 1.25rem;
        }
        .a-meta {
          color: var(--ink-soft);
          font-size: 0.875rem;
        }
        .attempt-head :global(.chev) {
          flex: none;
          color: var(--muted);
        }
        .attempt-body {
          padding: 1rem 1.25rem 1.25rem;
          border-top: 1.5px solid var(--line);
        }
        .a-grid {
          max-width: 360px;
        }
        .empty {
          color: var(--muted);
          font-size: 0.875rem;
          margin: 1rem 0 0;
        }
        .log-list {
          list-style: none;
          padding: 0;
          margin: 1.1rem 0 0;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .log-list li {
          display: grid;
          grid-template-columns: 4.5rem minmax(0, 1fr);
          gap: 0.75rem;
          font-size: 0.875rem;
          overflow-wrap: anywhere;
        }
        @media (max-width: 30em) {
          /* A phone, or large text: the day sits above its log. */
          .log-list li {
            grid-template-columns: minmax(0, 1fr);
            gap: 0.15rem;
          }
        }
        .log-day {
          font-family: var(--font-mono);
          color: var(--muted);
          font-size: 0.8rem;
          padding-top: 0.1rem;
        }
        .log-text {
          color: var(--ink-soft);
          line-height: 1.45;
        }
      `}</style>
    </li>
  )
}
