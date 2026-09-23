'use client'

import { useEffect, useRef } from 'react'
import { DayData, Repository } from '@/lib/repository'
import { Day } from '@/lib/types'
import { ArtifactThumb } from './ArtifactInput'
import { Icon } from './Icon'

const STATE_LINE: Record<Day['state'], string> = {
  complete: 'Made',
  skipped: 'Covered by a skip token',
  missed: 'Missed',
  today: 'Today',
  future: 'Upcoming',
}

/** A past day, opened from the grid: what was written and kept that day. */
export function DayDetail({
  day,
  dayData,
  repo,
  onClose,
}: {
  day: Day
  dayData: DayData
  repo: Repository
  onClose: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  const log = dayData.logs[day.index]?.text.trim()
  const artifacts = dayData.artifacts[day.index] ?? []

  useEffect(() => {
    ref.current?.focus()
  }, [day.index])

  return (
    <section
      ref={ref}
      className="detail"
      tabIndex={-1}
      aria-labelledby="detail-title"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <header className="d-head">
        <h3 id="detail-title" className="font-display d-title">
          Day {day.index}
          <span className={`d-state st-${day.state}`}>{STATE_LINE[day.state]}</span>
        </h3>
        <button type="button" className="close" onClick={onClose} aria-label={`Close Day ${day.index}`}>
          <Icon name="close" size={18} />
        </button>
      </header>
      {log ? <p className="d-log">{log}</p> : <p className="d-empty">No log that day.</p>}
      {artifacts.length > 0 && (
        <ul className="d-thumbs" aria-label={`Day ${day.index} artifacts`}>
          {artifacts.map((a) => (
            <li key={a.id}>
              <ArtifactThumb artifact={a} repo={repo} size={72} />
            </li>
          ))}
        </ul>
      )}
      <style jsx>{`
        .detail {
          margin-top: 1rem;
          padding: 1rem 1.1rem;
          border-radius: 10px;
          background: var(--paper);
          border: 1.5px solid var(--line);
        }
        .detail:focus-visible {
          outline: 3px solid var(--cobalt);
        }
        .d-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
        }
        .d-title {
          font-size: 1.25rem;
          margin: 0;
          display: flex;
          align-items: baseline;
          gap: 0.6rem;
          flex-wrap: wrap;
        }
        .d-state {
          font-family: var(--font-mono);
          font-weight: 400;
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .st-complete {
          color: var(--cobalt);
        }
        .st-skipped {
          color: var(--marigold-ink);
        }
        .close {
          flex: none;
          width: 44px;
          height: 44px;
          margin: -0.6rem -0.6rem 0 0;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: var(--ink-soft);
          cursor: pointer;
        }
        .close:hover {
          background: var(--paper-2);
        }
        .d-log {
          margin: 0.6rem 0 0;
          line-height: 1.55;
          white-space: pre-wrap;
        }
        .d-empty {
          margin: 0.6rem 0 0;
          color: var(--muted);
        }
        .d-thumbs {
          list-style: none;
          margin: 0.9rem 0 0;
          padding: 0;
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
      `}</style>
    </section>
  )
}
