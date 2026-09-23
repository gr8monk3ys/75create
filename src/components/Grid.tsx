'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { Day } from '@/lib/types'
import { stampRotation as rotation } from '@/lib/stamp'


const COLS = 15

const LABELS: Record<Day['state'], string> = {
  complete: 'made',
  today: 'today',
  missed: 'missed',
  skipped: 'covered by a skip token',
  future: 'upcoming',
}

const LEGEND = [
  ['complete', 'sw-c', 'made'],
  ['today', 'sw-t', 'today'],
  ['skipped', 'sw-s', 'skipped'],
  ['missed', 'sw-m', 'missed'],
  ['future', 'sw-f', 'to come'],
] as const

/**
 * The key to the grid's marks, listing only the states on it. `today` keeps
 * "today" listed once today is made (its ring stays on the stamp). Visual
 * only: the grid's own summary says the same to a screen reader.
 */
export function GridLegend({ days, today = false }: { days: Day[]; today?: boolean }) {
  const shown = LEGEND.filter(([state]) => (state === 'today' && today) || days.some((d) => d.state === state))
  return (
    <span className="grid-legend font-mono" aria-hidden>
      {shown.map(([state, sw, label]) => (
        <span key={state}>
          <i className={`sw ${sw}`} /> {label}
        </span>
      ))}
    </span>
  )
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
  const toGo = count('future') + (today ? 1 : 0)
  if (endedOn) parts.push(`ended on Day ${endedOn}`)
  else parts.push(toGo > 0 ? `${toGo} to go` : 'every day settled')
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
  /** Today's index: once made, its stamp keeps a today ring. */
  today?: number | null
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
  today = null,
}: Props) {
  const summary = gridSummary(days, endedOn)
  const interactive = Boolean(onOpenDay)
  const openable = days.filter((d) => d.state !== 'future').map((d) => d.index)
  const last = openable[openable.length - 1] ?? 1
  // Roving tabindex: the grid is one Tab stop; arrows move within it.
  const [active, setActive] = useState<number>(selected ?? last)
  // Stepping days in the detail moves the selection: the grid's one Tab
  // stop follows it, so Shift+Tab back in lands on the day on show.
  const [seenSelected, setSeenSelected] = useState(selected)
  if (selected !== seenSelected) {
    setSeenSelected(selected)
    if (selected != null) setActive(selected)
  }
  const current = openable.includes(active) ? active : last
  const cells = useRef<Record<number, HTMLButtonElement | null>>({})

  useEffect(() => {
    if (!focusKey || refocus == null) return
    cells.current[refocus]?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey])

  function move(to: number) {
    // Off the edge of the days you can open (up from row one, down past
    // today): stay put rather than jump somewhere unexpected.
    if (to < (openable[0] ?? 1) || to > last) return
    setActive(to)
    cells.current[to]?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    // Esc on the open day's own cell closes it, as it does inside the detail.
    if (e.key === 'Escape' && selected === index) {
      e.preventDefault()
      onOpenDay?.(index)
      return
    }
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
          const madeToday = d.index === today && d.state === 'complete'
          const title = `Day ${d.index}, ${madeToday ? 'made today' : LABELS[d.state]}`
          const cls = `cell cell-${d.state} ${madeToday ? 'made-today' : ''} ${selected === d.index ? 'sel' : ''} ${stamp === d.index ? 'stamp' : ''}`
          const style = { '--rot': `${rotation(d.index)}deg` } as React.CSSProperties
          const mark =
            // The mark is drawn, not read: the cell's name is its day and state.
            d.state === 'skipped' ? <span className="cell-mark" aria-hidden>–</span>
            : d.state === 'missed' ? <span className="cell-mark" aria-hidden>×</span>
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
                // The title is the name (and the hover tooltip); an
                // aria-label too would have it read twice, as a description.
                title={title}
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
          /* The mark is sized from the cell, not the text size: at large
             text it would otherwise outgrow the cell and warp the grid. */
          container-type: inline-size;
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
        /* Made today: the cobalt stamp keeps today's coral ring, outside it. */
        .cell.made-today {
          outline: 2px solid var(--cell-today);
          outline-offset: 2px;
        }
        /* Focus outranks the today ring: the grid's Tab stop must show it. */
        .cell.made-today:focus-visible {
          outline: 3px solid var(--cobalt);
          outline-offset: 3px;
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
          font-size: min(0.875rem, 62cqi);
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
            font-size: min(0.7rem, 62cqi);
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
