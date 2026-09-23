'use client'

import { memo } from 'react'
import type { Phase, Stakes } from '@/lib/challengeSession'
import { MAX_SKIP_TOKENS, TOTAL_DAYS } from '@/lib/types'
import { POLICY_NAMES } from '@/lib/format'

interface Props {
  dayIndex: number
  current: number
  longest: number
  totalDays: number
  /** Omitted on the read-only share page. */
  phase?: Phase
  stakes?: Stakes | null
  missedDay?: number | null
  /** Days completed, shown once the challenge is finished. */
  made?: number
}

/**
 * The always-visible status line: where you are, how the run is going, and
 * what a miss costs. The stakes stay on screen for all 75 days because
 * they're the point of the format, not a setting you chose once.
 */
export const StreakHeader = memo(function StreakHeader({
  dayIndex,
  current,
  longest,
  totalDays,
  phase,
  stakes,
  missedDay,
  made,
}: Props) {
  const day = Math.min(Math.max(dayIndex, 0), totalDays)
  const ended = phase === 'reset-pending'
  const after = phase === 'maintenance' || (phase === 'finished' && dayIndex > totalDays)

  return (
    <dl className="head">
      <div className="stat stat-day">
        <dt>{ended && missedDay ? 'Ended on day' : after ? 'Finished' : 'Day'}</dt>
        <dd className="big font-display">
          {ended && missedDay ? (
            <>
              {missedDay}
              <span className="denom">/{totalDays}</span>
            </>
          ) : after ? (
            <>
              {made ?? totalDays}
              <span className="denom">/{totalDays} made</span>
            </>
          ) : (
            <>
              {day}
              <span className="denom">/{totalDays}</span>
            </>
          )}
        </dd>
      </div>
      {!after && !ended && (
        <div className="stat">
          <dt>Streak</dt>
          <dd className="num font-display">
            {current}
            <span className="unit">
              {current === 1 ? 'day' : 'days'}
              {current > 0 && current === longest ? ' · your longest yet' : ''}
            </span>
          </dd>
        </div>
      )}
      {/* Longest adds nothing when it equals the streak, or when both are
          zero on a fresh Day 1. */}
      {(after || ended || (longest > 0 && current !== longest)) && (
        <div className="stat">
          <dt>Longest</dt>
          <dd className="num font-display">
            {longest}
            <span className="unit">{longest === 1 ? 'day' : 'days'}</span>
          </dd>
        </div>
      )}
      {/* Once the last day is made there is nothing left to miss. */}
      {stakes && !after && phase !== 'finished' && (
        <StakesStat
          stakes={stakes}
          totalDays={totalDays}
          // "How today works" lives in the check-in card: link to it only
          // when there is one on the page.
          explained={phase === 'active'}
        />
      )}
      {!stakes && totalDays > TOTAL_DAYS && (
        <div className="stat">
          <dt>Extended</dt>
          <dd className="num font-display">+{totalDays - TOTAL_DAYS}</dd>
        </div>
      )}
      <style jsx>{`
        .head {
          display: flex;
          gap: 1.25rem 1.75rem;
          align-items: flex-end;
          flex-wrap: wrap;
          margin: 0;
        }
        .stat {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        dt {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
        }
        dd {
          margin: 0;
        }
        .big {
          font-size: clamp(2.8rem, 12vw, 4.5rem);
          color: var(--ink);
          font-variant-numeric: tabular-nums;
        }
        .denom {
          /* Follows the numeral, held to the ramp (Body to Title-lg). */
          font-size: clamp(1rem, 0.36em, 1.5rem);
          color: var(--muted);
          margin-left: 0.15em;
          letter-spacing: 0;
        }
        .num {
          font-size: clamp(1.8rem, 7vw, 2.6rem);
          display: flex;
          align-items: baseline;
          gap: 0.3rem;
          font-variant-numeric: tabular-nums;
        }
        .unit {
          /* Never below the 11px floor, however small the number gets. */
          font-size: max(0.75rem, 0.34em);
          font-family: var(--font-mono);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--muted);
        }
        .stat-day {
          margin-right: auto;
        }
      `}</style>
    </dl>
  )
})

function PolicyName({ name, explained }: { name: string; explained: boolean }) {
  return explained ? (
    <a href="#how-today" className="policy-link">
      {name}
    </a>
  ) : (
    <>{name}</>
  )
}

function StakesStat({
  stakes,
  totalDays,
  explained,
}: {
  stakes: Stakes
  totalDays: number
  explained: boolean
}) {
  if (stakes.policy === 'grace') {
    const left = stakes.tokensLeft ?? 0
    return (
      <div className="stat stakes">
        <dt>
          <PolicyName name={POLICY_NAMES.grace} explained={explained} />
        </dt>
        <dd className="tokens">
          <span className="pips" aria-hidden>
            {Array.from({ length: MAX_SKIP_TOKENS }, (_, i) => (
              <i key={i} className={i < left ? 'pip on' : 'pip'} />
            ))}
          </span>
          <span className="tok-label">
            {left === 0 ? 'No skips left · a miss restarts' : `${left} ${left === 1 ? 'skip' : 'skips'} left`}
          </span>
        </dd>
        <style jsx>{`
          .stat {
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
          }
          dt {
            font-family: var(--font-mono);
            font-size: 0.75rem;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: var(--muted);
          }
          .tokens {
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
            min-height: 2.6rem;
            justify-content: flex-end;
          }
          .pips {
            display: flex;
            gap: 0.35rem;
          }
          .pip {
            width: 1.1rem;
            height: 1.1rem;
            border-radius: 4px;
            border: 1.5px dashed var(--muted);
          }
          .pip.on {
            border: 0;
            background: var(--cell-skipped);
            transform: rotate(-4deg);
            box-shadow: 1px 1.5px 0 color-mix(in srgb, var(--ink) 22%, transparent);
          }
          .pip.on:nth-child(2) {
            transform: rotate(3deg);
          }
          .tok-label {
            font-family: var(--font-mono);
            font-size: 0.8rem;
            color: var(--ink-soft);
          }
          dt :global(.policy-link) {
            color: inherit;
            text-decoration: underline dotted;
            text-underline-offset: 0.3em;
            /* A 44px hit area around a short label, without moving it. */
            display: inline-block;
            padding: 0.9rem 0.6rem;
            margin: -0.9rem -0.6rem;
          }
          @media (max-width: 520px) {
            .stakes {
              flex: 1 0 100%;
              flex-direction: row;
              flex-wrap: wrap;
              min-width: 0;
              align-items: center;
              gap: 0.75rem;
            }
            .tokens {
              min-height: 0;
              flex-direction: row;
              flex-wrap: wrap;
              min-width: 0;
              align-items: center;
              gap: 0.6rem;
            }
          }
        `}</style>
      </div>
    )
  }
  const line =
    stakes.policy === 'classic'
      ? 'A miss restarts'
      : stakes.extraDays > 0
        ? `${totalDays} days (+${stakes.extraDays})`
        : 'A miss adds a day'
  return (
    <div className="stat stakes">
      <dt>
        <PolicyName name={POLICY_NAMES[stakes.policy]} explained={explained} />
      </dt>
      <dd className="line">{line}</dd>
      <style jsx>{`
        .stat {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        dt {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .line {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.875rem;
          color: var(--ink-soft);
          min-height: 2.6rem;
          display: flex;
          align-items: flex-end;
        }
        dt :global(.policy-link) {
          color: inherit;
          text-decoration: underline dotted;
          text-underline-offset: 0.3em;
          display: inline-block;
          padding: 0.9rem 0.6rem;
          margin: -0.9rem -0.6rem;
        }
        @media (max-width: 520px) {
          .stakes {
            flex: 1 0 100%;
            flex-direction: row;
            flex-wrap: wrap;
            min-width: 0;
            align-items: center;
            gap: 0.75rem;
          }
          .line {
            min-height: 0;
          }
        }
      `}</style>
    </div>
  )
}
