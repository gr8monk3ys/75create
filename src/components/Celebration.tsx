'use client'

import { useEffect } from 'react'

interface Props {
  show: boolean
  milestone?: number | null
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

export function Celebration({ show, milestone, onDone }: Props) {
  // Visibility is the `show` prop itself; the timer just hands control back to
  // the parent. `onDone` must be referentially stable or the timer restarts.
  useEffect(() => {
    if (!show) return
    const t = setTimeout(onDone, 2600)
    return () => clearTimeout(t)
  }, [show, onDone])

  if (!show) return null

  const message = milestone
    ? milestoneMessage(milestone)
    : { title: 'Day done.', sub: 'One more mark on the grid.' }

  return (
    <div className="cel" role="status" aria-live="polite">
      <div className="confetti" aria-hidden>
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="bit"
            style={{
              left: `${c.left}%`,
              background: c.color,
              animationDelay: `${c.delay}s`,
              transform: `rotate(${c.rot}deg)`,
            }}
          />
        ))}
      </div>
      <div className="card panel">
        {milestone && <span className="milestone font-mono">Day {milestone}</span>}
        <h2 className="font-display">{message.title}</h2>
        <p>{message.sub}</p>
      </div>

      <style jsx>{`
        .cel {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: grid;
          place-items: center;
          pointer-events: none;
          background: color-mix(in srgb, var(--paper) 40%, transparent);
        }
        .card {
          text-align: center;
          padding: 1.75rem 2.5rem;
          background: var(--paper);
          box-shadow: 6px 8px 0 var(--cobalt);
          animation: pop-in 0.4s ease both;
        }
        .card h2 {
          font-size: 2rem;
          margin: 0.3rem 0;
        }
        .card p {
          color: var(--ink-soft);
          margin: 0;
        }
        .milestone {
          font-size: 0.72rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--coral);
        }
        .confetti {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        .bit {
          position: absolute;
          top: -5%;
          width: 9px;
          height: 14px;
          border-radius: 2px;
          animation: fall 2.4s linear forwards;
        }
        @keyframes fall {
          to {
            top: 105%;
          }
        }
      `}</style>
    </div>
  )
}

function milestoneMessage(day: number): { title: string; sub: string } {
  switch (day) {
    case 7:
      return { title: 'One week in.', sub: 'The hardest part is starting. You started.' }
    case 25:
      return { title: 'A third of the way.', sub: 'This is a habit now, not a whim.' }
    case 50:
      return { title: 'Two-thirds done.', sub: '25 to go. You can see the finish.' }
    case 75:
      return { title: '75 days.', sub: 'You finished. Go see what you made.' }
    default:
      return { title: `Day ${day}.`, sub: 'Keep the grid going.' }
  }
}
