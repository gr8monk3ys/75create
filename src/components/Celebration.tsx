'use client'

import { useEffect } from 'react'
import { Day } from '@/lib/types'
import { Grid } from './Grid'

interface Props {
  show: boolean
  /** Headline and line for a milestone day; the plain "made" copy otherwise. */
  milestone?: { title: string; sub: string } | null
  /** The day just completed, stamped into the grid inside the card. */
  dayIndex: number
  days: Day[]
  onDone: () => void
}

const PIGMENTS = ['var(--cobalt)', 'var(--coral)', 'var(--marigold)', 'var(--pink)', 'var(--moss)']

// Deterministic confetti specs so there's no hydration mismatch.
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 8) * 0.05,
  color: PIGMENTS[i % PIGMENTS.length],
  rot: ((i * 53) % 90) - 45,
}))

/**
 * The day's peak: the grid itself, with today's mark stamping in. The grid is
 * the reward, so the moment shows it rather than describing it.
 */
export function Celebration({ show, milestone, dayIndex, days, onDone }: Props) {
  // Visibility is the `show` prop itself; the timer just hands control back to
  // the parent. `onDone` must be referentially stable or the timer restarts.
  useEffect(() => {
    if (!show) return
    const t = setTimeout(onDone, 3200)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone()
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
    }
  }, [show, onDone])

  if (!show) return null

  const message = milestone ?? { title: `Day ${dayIndex}, made.`, sub: 'One more mark on the grid.' }

  return (
    // Visual only: the check-in card's own live region announces the day.
    <div className="cel" aria-hidden>
      <div className="confetti" aria-hidden>
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="bit"
            style={
              {
                left: `${c.left}%`,
                background: c.color,
                animationDelay: `${c.delay}s`,
                '--r': `${c.rot}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="card panel">
        <h2 className="font-display">{message.title}</h2>
        <p>{message.sub}</p>
        <div className="mini" aria-hidden>
          <Grid days={days} compact stamp={dayIndex} />
        </div>
      </div>

      <style jsx>{`
        .cel {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: grid;
          place-items: center;
          padding: 1rem;
          background: color-mix(in srgb, var(--paper) 55%, transparent);
          /* Never in the way: the next tap still reaches the page. */
          pointer-events: none;
        }
        .card {
          width: min(100%, 22rem);
          text-align: center;
          padding: 1.6rem 1.6rem 1.4rem;
          background: var(--paper);
          box-shadow: 6px 8px 0 var(--cobalt);
          animation: pop-in 0.4s cubic-bezier(0.25, 1, 0.5, 1) both;
        }
        .card h2 {
          font-size: clamp(1.5rem, 5vw, 1.9rem);
          margin: 0 0 0.35rem;
          text-wrap: balance;
        }
        .card p {
          color: var(--ink-soft);
          margin: 0 0 1.1rem;
          line-height: 1.45;
        }
        .mini {
          padding: 0.6rem;
          border-radius: 10px;
          background: var(--paper-2);
        }
        .confetti {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .bit {
          position: absolute;
          top: -16px;
          /* Little pigment stamps, the same marks the grid is made of. */
          width: 11px;
          height: 11px;
          border-radius: 2px;
          transform: rotate(var(--r));
          animation: fall 2.4s cubic-bezier(0.3, 0.1, 0.6, 1) forwards;
        }
        @keyframes fall {
          to {
            transform: translateY(105vh) rotate(calc(var(--r) + 220deg));
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .confetti {
            display: none;
          }
          .card {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
