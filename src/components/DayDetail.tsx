'use client'

import { useEffect, useRef } from 'react'
import { DayData } from '@/lib/repository'
import { Day, MissPolicy } from '@/lib/types'
import { ArtifactThumb } from './ArtifactInput'
import { Icon } from './Icon'

export const DAY_DETAIL_ID = 'day-detail'

const STATE_LINE: Record<Day['state'], string> = {
  complete: 'Made',
  skipped: 'Covered by a skip token',
  missed: 'Missed',
  today: 'Today',
  future: 'Upcoming',
}

/**
 * A past day, opened from the grid: what was written and kept that day.
 * Previous / next step through the days with full-size targets, so browsing
 * never depends on hitting a small grid cell on a phone.
 */
export function DayDetail({
  day,
  dayData,
  onClose,
  onStep,
  hasPrev,
  hasNext,
  missPolicy,
}: {
  day: Day
  dayData: DayData
  onClose: () => void
  onStep: (delta: -1 | 1) => void
  hasPrev: boolean
  hasNext: boolean
  /** Under Extend, a missed day says what it cost. */
  missPolicy?: MissPolicy
}) {
  const ref = useRef<HTMLElement>(null)
  const log = dayData.logs[day.index]?.text.trim()
  const artifacts = dayData.artifacts[day.index] ?? []

  // Take focus once, when the detail opens. Stepping between days leaves
  // focus on the button that was pressed (the title's live region says which
  // day is showing). At either end the button stays focusable, marked
  // aria-disabled: a real `disabled` would drop focus to the page.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])

  return (
    <section
      ref={ref}
      id={DAY_DETAIL_ID}
      className="detail"
      tabIndex={-1}
      aria-labelledby="detail-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <header className="d-head">
        <h3 id="detail-title" className="font-display d-title" aria-live="polite">
          Day {day.index}
          <span className="sr-only">, </span>
          <span className={`d-state st-${day.state}`}>{STATE_LINE[day.state]}</span>
        </h3>
        <div className="d-nav">
          <button
            type="button"
            className="icon-btn"
            onClick={() => hasPrev && onStep(-1)}
            aria-disabled={!hasPrev}
            aria-label="Previous day"
          >
            <Icon name="chevron" size={18} className="flip" />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => hasNext && onStep(1)}
            aria-disabled={!hasNext}
            aria-label="Next day"
          >
            <Icon name="chevron" size={18} />
          </button>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={`Close Day ${day.index}`}>
            <Icon name="close" size={18} />
          </button>
        </div>
      </header>
      {day.state === 'missed' && missPolicy === 'extend' && dayData.actionedMisses.includes(day.index) && (
        <p className="d-empty">Extend added a day to the end for it.</p>
      )}
      {log ? <p className="d-log">{log}</p> : <p className="d-empty">No log that day.</p>}
      {artifacts.length > 0 && (
        <ul className="d-thumbs" aria-label={`Day ${day.index} artifacts`}>
          {artifacts.map((a) => (
            <li key={a.id}>
              <ArtifactThumb artifact={a} size={72} dayIndex={day.index} />
            </li>
          ))}
        </ul>
      )}
      <style jsx>{`
        .detail {
          margin-top: 1.1rem;
          padding-top: 0.9rem;
          border-top: 1.5px dashed var(--line);
        }
        .detail:focus {
          outline: none;
        }
        .detail:focus-visible .d-title {
          text-decoration: underline;
          text-decoration-color: var(--cobalt);
          text-underline-offset: 0.2em;
        }
        .d-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
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
        .d-nav {
          display: flex;
          flex: none;
          margin-right: -0.6rem;
        }
        .icon-btn {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: var(--ink-soft);
          cursor: pointer;
        }
        .icon-btn:hover:not([aria-disabled='true']) {
          background: var(--paper);
          color: var(--ink);
        }
        .icon-btn[aria-disabled='true'] {
          /* Faint but there: the end of the range is visible, not a gap. */
          color: var(--muted);
          opacity: 0.45;
          cursor: default;
        }
        .icon-btn :global(.flip) {
          transform: scaleX(-1);
        }
        .d-log {
          margin: 0.5rem 0 0;
          line-height: 1.55;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .d-empty {
          margin: 0.5rem 0 0;
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
