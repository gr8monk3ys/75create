'use client'

import { Day } from '@/lib/types'

/** Deterministic small rotation (-3.5°..3.5°) so stamps feel hand-placed. */
function rotation(index: number): number {
  return (((index * 37) % 15) - 7) / 2
}

const LABELS: Record<Day['state'], string> = {
  complete: 'made',
  today: 'today',
  missed: 'missed',
  skipped: 'covered by a skip token',
  future: 'upcoming',
}

/** One sentence a screen reader can say instead of 75 separate cells. */
export function gridSummary(days: Day[]): string {
  const count = (s: Day['state']) => days.filter((d) => d.state === s).length
  const today = days.find((d) => d.state === 'today')
  const parts = [`${count('complete')} made`]
  if (count('skipped')) parts.push(`${count('skipped')} skipped`)
  if (count('missed')) parts.push(`${count('missed')} missed`)
  parts.push(`${count('future') + (today ? 1 : 0)} to go`)
  return `${days.length}-day grid: ${parts.join(', ')}.`
}

interface Props {
  days: Day[]
  compact?: boolean
  /** Makes settled days (and today) openable. */
  onOpenDay?: (index: number) => void
  /** The day currently opened, drawn with a ring. */
  selected?: number | null
  /** A day to stamp in with the pop-in animation (e.g. just completed). */
  stamp?: number | null
}

export function Grid({ days, compact = false, onOpenDay, selected = null, stamp = null }: Props) {
  const summary = gridSummary(days)
  const interactive = Boolean(onOpenDay)

  return (
    <div className={`grid-wrap ${compact ? 'grid-compact' : ''}`}>
      <div
        className="grid-cells"
        role={interactive ? 'group' : 'img'}
        aria-label={interactive ? `${summary} Choose a day to open it.` : summary}
      >
        {days.map((d) => {
          const title = `Day ${d.index}, ${LABELS[d.state]}`
          const cls = `cell cell-${d.state} ${selected === d.index ? 'sel' : ''} ${stamp === d.index ? 'stamp' : ''}`
          const style = { '--rot': `${rotation(d.index)}deg` } as React.CSSProperties
          const mark =
            d.state === 'skipped' ? <span className="cell-mark">–</span>
            : d.state === 'missed' ? <span className="cell-mark">·</span>
            : null
          if (interactive && d.state !== 'future') {
            return (
              <button
                key={d.index}
                type="button"
                className={cls}
                style={style}
                title={title}
                aria-label={title}
                aria-pressed={selected === d.index}
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
          grid-template-columns: repeat(15, 1fr);
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
        button.cell:hover {
          transform: rotate(var(--rot)) scale(1.12);
        }
        .cell-future {
          border: 1.5px dotted var(--line);
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
          animation: today-pulse 2s ease-in-out infinite;
        }
        .cell-skipped {
          background: color-mix(in srgb, var(--cell-skipped) 85%, transparent);
          transform: rotate(var(--rot));
        }
        .cell-missed {
          background: repeating-linear-gradient(
            -45deg,
            var(--cell-missed),
            var(--cell-missed) 2px,
            transparent 2px,
            transparent 5px
          );
          border: 1.5px solid var(--cell-missed);
        }
        .cell.sel {
          outline: 2.5px solid var(--ink);
          outline-offset: 2px;
        }
        .cell.stamp {
          animation: pop-in 0.55s cubic-bezier(0.25, 1, 0.5, 1) both;
        }
        .cell-mark {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: color-mix(in srgb, var(--ink) 60%, transparent);
          line-height: 1;
        }
        .grid-compact .cell-mark {
          display: none;
        }
        @media (max-width: 520px) {
          .grid-cells {
            gap: ${compact ? '3px' : '4px'};
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
}
