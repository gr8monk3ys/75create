'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/components/AppProvider'
import { RuleEditor } from '@/components/RuleEditor'
import { Icon } from '@/components/Icon'
import { ChallengeDraft, draftProblem } from '@/lib/challengeSession'
import { addDays } from '@/lib/creativeDay'
import {
  DEFAULT_RULES,
  Medium,
  MissPolicy,
  Rule,
} from '@/lib/types'

const MEDIA: { id: Medium; label: string }[] = [
  { id: 'writing', label: 'Writing' },
  { id: 'drawing', label: 'Drawing' },
  { id: 'music', label: 'Music' },
  { id: 'photography', label: 'Photography' },
  { id: 'video', label: 'Video' },
  { id: 'code', label: 'Code / generative' },
  { id: 'mixed', label: 'Mixed' },
  { id: 'other', label: 'Other' },
]

const POLICIES: { id: MissPolicy; name: string; line: string }[] = [
  { id: 'classic', name: 'Classic', line: 'Any missed day restarts you at Day 1.' },
  { id: 'grace', name: 'Grace', line: 'Three skip tokens for life. A fourth miss resets.' },
  { id: 'extend', name: 'Extend', line: 'A missed day adds a day to the end. Streak resets, challenge continues.' },
]

export default function Setup() {
  const { user, challenge, creativeToday, startChallenge, loading } = useApp()
  const router = useRouter()
  const [step, setStep] = useState(0)

  const [medium, setMedium] = useState<Medium>('mixed')
  const [rules, setRules] = useState<Rule[]>(() =>
    DEFAULT_RULES.map((r) => ({ ...r })),
  )
  const [policy, setPolicy] = useState<MissPolicy>('grace')
  const [startChoice, setStartChoice] = useState<'today' | 'future'>('today')
  const [futureDate, setFutureDate] = useState('')
  const [why, setWhy] = useState('')

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) router.replace('/signin')
    // One challenge at a time: a running one is finished or reset from the dashboard.
    else if (challenge) router.replace('/dashboard')
  }, [loading, user, challenge, router])

  const draft: ChallengeDraft = {
    medium,
    rules,
    missPolicy: policy,
    start: startChoice === 'today' || !futureDate ? 'today' : futureDate,
    whyNote: why,
  }
  const problem =
    step === 2 && startChoice === 'future' && !futureDate
      ? 'Pick a start date, or choose Today.'
      : draftProblem(draft)
  const canFinish = problem === null
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Each step replaces the last: move focus to its heading so keyboard and
  // screen-reader users land at the top of the new step, not on the page.
  const [moved, setMoved] = useState(false)
  useEffect(() => {
    if (moved) headingRef.current?.focus()
  }, [step, moved])
  function go(to: number) {
    setMoved(true)
    setStep(to)
  }

  // A picked start date is tomorrow at the earliest, in the user's creative day.
  const tomorrow = creativeToday ? addDays(creativeToday, 1) : undefined

  function finish() {
    if (!canFinish) return
    try {
      startChallenge(draft)
      router.push('/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the challenge.')
    }
  }

  return (
    <main className="setup">
      <ol className="steps font-mono" aria-label="Setup steps">
        {['Medium', 'Rules', 'Stakes'].map((s, i) => (
          <li
            key={s}
            className={`step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}
            aria-current={i === step ? 'step' : undefined}
          >
            {i + 1} {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="pane">
          <h1 className="font-display setup-h1" ref={headingRef} tabIndex={-1}>
            What are you making?
          </h1>
          <p className="sub">This just tailors the wording. You can mix media freely.</p>
          <div className="media-grid">
            {MEDIA.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`media ${medium === m.id ? 'sel' : ''}`}
                onClick={() => setMedium(m.id)}
                aria-pressed={medium === m.id}
              >
                <Icon name={m.id} size={26} className="glyph" />
                {m.label}
              </button>
            ))}
          </div>
          <div className="nav-row">
            <span />
            <button className="btn" onClick={() => go(1)}>
              Next: rules
            </button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="pane">
          <h1 className="font-display setup-h1" ref={headingRef} tabIndex={-1}>
            Your daily rules
          </h1>
          <p className="sub">
            Start from the default five or make them yours — 3 to 7 tasks. These
            lock once you begin.
          </p>
          <RuleEditor rules={rules} onChange={setRules} />
          <div className="nav-row">
            <button className="btn btn-ghost" onClick={() => go(0)}>
              Back
            </button>
            <button className="btn" onClick={() => go(2)} disabled={!canFinish}>
              Next: stakes
            </button>
          </div>
          {problem && (
            <p className="form-hint font-mono" role="status">
              {problem}
            </p>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="pane">
          <h1 className="font-display setup-h1" ref={headingRef} tabIndex={-1}>
            Set your stakes
          </h1>

          <div className="policy-choices">
            {POLICIES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`policy-pick ${policy === p.id ? 'sel' : ''}`}
                onClick={() => setPolicy(p.id)}
                aria-pressed={policy === p.id}
              >
                <span className="pname font-display">{p.name}</span>
                <span className="pline">{p.line}</span>
              </button>
            ))}
          </div>
          <p className="lock-note font-mono">This choice locks when you start. Choose honestly.</p>

          <div className="start-block">
            <span className="field-label" id="start-label">Start date</span>
            <div className="start-row" role="group" aria-labelledby="start-label">
              <button
                type="button"
                className={`chip ${startChoice === 'today' ? 'sel' : ''}`}
                onClick={() => setStartChoice('today')}
                aria-pressed={startChoice === 'today'}
              >
                Today
              </button>
              <button
                type="button"
                className={`chip ${startChoice === 'future' ? 'sel' : ''}`}
                onClick={() => setStartChoice('future')}
                aria-pressed={startChoice === 'future'}
              >
                Pick a date
              </button>
              {startChoice === 'future' && (
                <input
                  type="date"
                  className="field-input date"
                  aria-label="Start date"
                  value={futureDate}
                  min={tomorrow}
                  onChange={(e) => setFutureDate(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="why-block">
            <label className="field-label" htmlFor="why">
              Why are you starting?
            </label>
            <p className="why-hint" id="why-hint">
              We&apos;ll show this back to you on the hard days. One or two lines.
            </p>
            <textarea
              id="why"
              aria-describedby="why-hint"
              className="field-input why-input"
              rows={3}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Because I want to finish something for once…"
            />
          </div>

          <div className="nav-row">
            <button className="btn btn-ghost" onClick={() => go(1)}>
              Back
            </button>
            <button className="btn" onClick={finish} disabled={!canFinish}>
              Start my 75
            </button>
          </div>
          {(error || problem) && (
            <p className="form-hint font-mono" role="alert">
              {error ?? problem}
            </p>
          )}
        </section>
      )}

      <style jsx>{`
        .form-hint {
          margin: 0.75rem 0 0;
          font-size: 0.75rem;
          color: var(--coral-ink);
          text-align: right;
        }
        .setup {
          max-width: 640px;
          padding-top: 2rem;
        }
        .steps {
          list-style: none;
          padding: 0;
          display: flex;
          gap: 1rem;
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }
        .step.on {
          color: var(--ink);
          font-weight: 700;
        }
        .step.done {
          color: var(--ink);
        }
        .date {
          width: auto;
        }
        .setup-h1:focus {
          outline: none;
        }
        .setup-h1 {
          font-size: clamp(2rem, 6vw, 3rem);
          margin: 0.5rem 0 0.75rem;
        }
        .sub {
          color: var(--ink-soft);
          margin: 0 0 1.75rem;
          line-height: 1.5;
        }
        .media-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }
        .media {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.1rem;
          border-radius: 14px;
          border: 1.5px solid var(--line);
          background: var(--paper-2);
          color: var(--ink);
          font-family: var(--font-body);
          font-size: 1rem;
          min-height: 56px;
          cursor: pointer;
          transition:
            border-color 0.12s ease,
            box-shadow 0.12s ease;
        }
        .media:hover {
          border-color: var(--ink-soft);
        }
        .media.sel {
          border-color: var(--cobalt);
          box-shadow: 3px 4px 0 var(--cobalt);
        }
        .media :global(.glyph) {
          flex: none;
          color: var(--cobalt);
        }
        .nav-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 2.5rem;
          gap: 1rem;
        }
        .policy-choices {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 1rem;
        }
        .policy-pick {
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          padding: 1rem 1.2rem;
          border-radius: 14px;
          border: 1.5px solid var(--line);
          background: var(--paper-2);
          cursor: pointer;
          color: var(--ink);
          transition:
            border-color 0.12s ease,
            box-shadow 0.12s ease;
        }
        .policy-pick.sel {
          border-color: var(--cobalt);
          box-shadow: 3px 4px 0 var(--cobalt);
        }
        .pname {
          font-size: 1.25rem;
        }
        .pline {
          color: var(--ink-soft);
          font-size: 0.875rem;
        }
        .lock-note {
          font-size: 0.8rem;
          color: var(--muted);
          margin: 0.9rem 0 2rem;
        }
        .start-row {
          display: flex;
          gap: 0.6rem;
          margin-top: 0.6rem;
          flex-wrap: wrap;
          align-items: center;
        }
        .start-block,
        .why-block {
          margin-top: 2rem;
        }
        .why-hint {
          color: var(--ink-soft);
          font-size: 0.875rem;
          margin: 0.4rem 0 0.7rem;
        }
      `}</style>
    </main>
  )
}
