'use client'

import { TOTAL_DAYS } from '@/lib/types'

interface Props {
  dayIndex: number
  current: number
  longest: number
  totalDays: number
}

export function StreakHeader({ dayIndex, current, longest, totalDays }: Props) {
  const day = Math.min(Math.max(dayIndex, 0), totalDays)
  return (
    <div className="head">
      <div className="stat stat-day">
        <span className="eyebrow">Day</span>
        <div className="big font-display">
          {day}
          <span className="denom">/{totalDays}</span>
        </div>
      </div>
      <div className="stat">
        <span className="eyebrow">Streak</span>
        <div className="num font-display">
          {current}
          <span className="unit">🔥</span>
        </div>
      </div>
      <div className="stat">
        <span className="eyebrow">Longest</span>
        <div className="num font-display">{longest}</div>
      </div>
      {totalDays > TOTAL_DAYS && (
        <div className="stat">
          <span className="eyebrow">Extended</span>
          <div className="num font-display">+{totalDays - TOTAL_DAYS}</div>
        </div>
      )}
      <style jsx>{`
        .head {
          display: flex;
          gap: 1.5rem;
          align-items: flex-end;
          flex-wrap: wrap;
        }
        .stat {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .big {
          font-size: clamp(2.8rem, 12vw, 4.5rem);
          color: var(--ink);
        }
        .denom {
          font-size: 0.42em;
          color: var(--muted);
          margin-left: 0.1em;
        }
        .num {
          font-size: clamp(1.8rem, 7vw, 2.6rem);
          display: flex;
          align-items: baseline;
          gap: 0.25rem;
        }
        .unit {
          font-size: 0.55em;
        }
        .stat-day {
          margin-right: auto;
        }
      `}</style>
    </div>
  )
}
