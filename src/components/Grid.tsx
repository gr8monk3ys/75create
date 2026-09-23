'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { Day } from '@/lib/types'

/** Deterministic small rotation (-3.5°..3.5°) so stamps feel hand-placed. */
function rotation(index: number): number {
  return (((index * 37) % 15) - 7) / 2
}

const COLS = 15

const LABELS: Record<Day['state'], string> = {
  complete: 'made',
  today: 'today',
  missed: 'missed',
  skipped: 'covered by a skip token',
  future: 'upcoming',
}

/**
 * One sentence a screen reader can say instead of 75 separate cells. An
 * ended attempt has nothing "to go": it says where it ended instead.
 */
export function gridSummary(days: Day[], endedOn: number | null = null): string {
  const count = (s: Day['state']) => days.filter((d) => d.state === s).length
  const today = days.find((d) => d.state === 'today')
  const parts = [`${count('complete')} made`]
  if (count('skipped')) parts.push(`${count('skipped')} skipped`)
  if (count('missed')) parts.push(`${count('missed')} missed`)
  if (endedOn) parts.push(`ended on Day ${endedOn}`)
  else parts.push(`${count('future') + (today ? 1 : 0)} to go`)
  return `${days.length}-day grid: ${parts.join(', ')}.`
}

interface Props {
  days: Day[]
  compact?: boolean
  /** Makes settled days (and today) openable. */
  onOpenDay?: (index: number) => void
  /** The day currently opened, drawn with a ring. */
  selected?: number | null
  /** Id of the element that shows the opened day (for aria-controls). */
  detailId?: string
  /** A day to stamp in with the pop-in animation (e.g. just completed). */
  stamp?: number | null
  /** Move keyboard focus onto this day's cell whenever `focusKey` changes
   *  (e.g. back to the cell a closed detail was opened from). */
  refocus?: number | null
  focusKey?: number
  /** The day an ended attempt ended on: nothing is left "to go". */
  endedOn?: number | null
}

/** Memoized: an autosave re-renders the page, but the day states it draws are unchanged. */
export const Grid = memo(function Grid({
  days,
  compact = false,
  onOpenDay,
  selected = null,
  detailId,
  stamp = null,
  refocus = null,
  focusKey = 0,
  endedOn = null,
}: Props) {
  const summary = gridSummary(days, endedOn)
  const interactive = Boolean(onOpenDay)
  const openable = days.filter((d) => d.state !== 'future').map((d) => d.index)
  const last = openable[openable.length - 1] ?? 1
  // Roving tabindex: the grid is one Tab stop; arrows move within it.
  const [active, setActive] = useState<number>(selected ?? last)
  const current = openable.includes(active) ? active : last
  const cells = useRef<Record<number, HTMLButtonElement | null>>({})

  useEffect(() => {
    if (!focusKey || refocus == null) return
    cells.current[refocus]?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey])

  function move(to: number) {
    const target = Math.min(Math.max(to, openable[0] ?? 1), last)
    setActive(target)
    cells.current[target]?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLS,
      ArrowUp: -COLS,
    }
    if (e.key in step) {
      e.preventDefault()
      move(index + step[e.key])
    } else if (e.key === 'Home') {
      e.preventDefault()
      move(openable[0] ?? 1)
    } else if (e.key === 'End') {
      e.preventDefault()
      move(last)
    }
  }

  return (
    <div className={`grid-wrap ${compact ? 'grid-compact' : ''}`}>
      <div
        className="grid-cells"
        role={interactive ? 'group' : 'img'}
        aria-label={
          interactive ? `${summary} Use the arrow keys to move between days; Enter opens one.` : summary
        }
      >
        {days.map((d) => {
          const title = `Day ${d.index}, ${LABELS[d.state]}`
          const cls = `cell cell-${d.state} ${selected === d.index ? 'sel' : ''} ${stamp === d.index ? 'stamp' : ''}`
          const style = { '--rot': `${rotation(d.index)}deg` } as React.CSSProperties
          const mark =
            d.state === 'skipped' ? <span className="cell-mark">–</span>
            : d.state === 'missed' ? <span className="cell-mark">×</span>
            : null
          if (interactive && d.state !== 'future') {
            return (
              <button
                key={d.index}
                ref={(el) => {
                  cells.current[d.index] = el
                }}
                type="button"
                className={cls}
                style={style}
                title={title}
                aria-label={title}
                aria-expanded={selected === d.index}
                aria-controls={selected === d.index ? detailId : undefined}
                tabIndex={d.index === current ? 0 : -1}
                onFocus={() => setActive(d.index)}
                onKeyDown={(e) => onKeyDown(e, d.index)}
                onClick={() => onOpenDay!(d.index)}
              >
                {mark}
              </button>
            )
          }
          return (
            <div key={d.index} className={cls} style={style} title={title} aria-hidden>
              {mark}
            </div>
          )
        })}
      </div>
      <style jsx>{`
        .grid-wrap {
          width: 100%;
        }
        .grid-cells {
          display: grid;
          grid-template-columns: repeat(${COLS}, minmax(0, 1fr));
          gap: ${compact ? '3px' : '6px'};
        }
        .cell {
          aspect-ratio: 1;
          border-radius: ${compact ? '2px' : '4px'};
          display: grid;
          place-items: center;
          padding: 0;
          border: 0;
          font: inherit;
          color: inherit;
          transition: transform 0.12s ease;
        }
        button.cell {
          cursor: pointer;
        }
        @media (hover: hover) {
          button.cell:hover {
            transform: rotate(var(--rot)) scale(1.12);
          }
        }
        .cell-future {
          border: 1.5px dotted var(--field-border);
          background: color-mix(in srgb, var(--paper-3) 30%, transparent);
        }
        .cell-complete {
          background: var(--cell-complete);
          transform: rotate(var(--rot));
          box-shadow: 1px 1.5px 0 color-mix(in srgb, var(--ink) 22%, transparent);
        }
        .cell-today {
          border: 2.5px solid var(--cell-today);
          background: color-mix(in srgb, var(--cell-today) 12%, transparent);
          animation: today-pulse 2s ease-in-out 3;
        }
        .cell-skipped {
          background: color-mix(in srgb, var(--cell-skipped) 85%, transparent);
          transform: rotate(var(--rot));
        }
        .cell-missed {
          background: repeating-linear-gradient(
            -45deg,
            var(--cell-missed),
            var(--cell-missed) 1.5px,
            transparent 1.5px,
            transparent 4px
          );
          border: 1.5px solid var(--cell-missed);
        }
        .cell.sel {
          outline: 2.5px solid var(--ink);
          outline-offset: 2px;
        }
        /* Focus outranks selection: the open day still shows where focus is. */
        .cell.sel:focus-visible {
          outline: 3px solid var(--cobalt);
          outline-offset: 3px;
        }
        .cell.stamp {
          animation: pop-in 0.55s cubic-bezier(0.25, 1, 0.5, 1) both;
        }
        .cell-mark {
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 0.875rem;
          color: var(--ink);
          line-height: 1;
        }
        .cell-skipped .cell-mark {
          /* Marigold is light in both themes: always dark ink on it. */
          color: var(--on-marigold);
        }
        .cell-missed .cell-mark {
          background: var(--paper-2);
          border-radius: 2px;
          padding: 0 1px;
        }
        .grid-compact .cell-mark {
          display: none;
        }
        /* Too small for a glyph, a compact skipped cell still carries a mark
           of its own (an ink bar across it), so skipped never depends on
           hue alone. */
        .grid-compact .cell-skipped {
          background:
            linear-gradient(var(--on-marigold), var(--on-marigold)) center / 60% 2px no-repeat,
            color-mix(in srgb, var(--cell-skipped) 85%, transparent);
        }
        @media (max-width: 520px) {
          .grid-cells {
            gap: ${compact ? '3px' : '4px'};
          }
          .cell-mark {
            font-size: 0.7rem;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .cell-today {
            animation: none;
          }
          .cell.stamp {
            animation: none;
          }
          .cell,
          button.cell:hover {
            transition: none;
          }
        }
      `}</style>
    </div>
  )
})
