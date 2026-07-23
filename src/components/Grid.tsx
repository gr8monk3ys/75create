'use client'

import { Day } from '@/lib/types'

/** Deterministic small rotation (-3.5°..3.5°) so stamps feel hand-placed. */
function rotation(index: number): number {
  return (((index * 37) % 15) - 7) / 2
}

const LABELS: Record<Day['state'], string> = {
  complete: 'completed',
  today: 'today',
  missed: 'missed',
  skipped: 'skipped',
  future: 'upcoming',
}

function Cell({ day }: { day: Day }) {
  const rot = rotation(day.index)
  const title = `Day ${day.index} — ${LABELS[day.state]}`
  return (
    <div
      className={`cell cell-${day.state}`}
      title={title}
      role="img"
      aria-label={title}
      style={{ '--rot': `${rot}deg` } as React.CSSProperties}
    >
      {day.state === 'skipped' && <span className="cell-mark">–</span>}
      {day.state === 'missed' && <span className="cell-mark">·</span>}
    </div>
  )
}

export function Grid({ days, compact = false }: { days: Day[]; compact?: boolean }) {
  return (
    <div className={`grid-wrap ${compact ? 'grid-compact' : ''}`}>
      <div className="grid-cells" role="list" aria-label="75-day progress grid">
        {days.map((d) => (
          <Cell key={d.index} day={d} />
        ))}
      </div>
      <style jsx>{`
        .grid-wrap {
          width: 100%;
        }
        .grid-cells {
          display: grid;
          grid-template-columns: repeat(15, 1fr);
          gap: ${compact ? '4px' : '6px'};
        }
        .cell {
          aspect-ratio: 1;
          border-radius: 4px;
          display: grid;
          place-items: center;
          transition: transform 0.12s ease;
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
        .cell-mark {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: color-mix(in srgb, var(--ink) 55%, transparent);
          line-height: 1;
        }
        @media (max-width: 520px) {
          .grid-cells {
            gap: 4px;
          }
        }
      `}</style>
    </div>
  )
}
