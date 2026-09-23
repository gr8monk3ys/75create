'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/components/AppProvider'
import { RuleEditor, ruleNameId, ruleRequiredId } from '@/components/RuleEditor'
import { Icon } from '@/components/Icon'
import { ChallengeDraft, draftProblem } from '@/lib/challengeSession'
import { addDays } from '@/lib/creativeDay'
import { POLICY_NAMES, POLICY_PITCHES, clockTime, longDay } from '@/lib/format'
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

const POLICY_ORDER: MissPolicy[] = ['classic', 'grace', 'extend']

const DRAFT_KEY = '75create.setupDraft'

interface SetupDraft {
  step: number
  medium: Medium
  rules: Rule[]
  policy: MissPolicy
  startChoice: 'today' | 'future'
  futureDate: string
  why: string
}

function readDraft(): SetupDraft | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as SetupDraft | null
    // Only a draft of the expected shape: anything else starts fresh.
    if (!d || !Array.isArray(d.rules) || !MEDIA.some((m) => m.id === d.medium)) return null
    if (!POLICY_ORDER.includes(d.policy) || ![0, 1, 2].includes(d.step)) return null
    return d
  } catch {
    return null
  }
}

function writeDraft(d: SetupDraft | null) {
  try {
    if (d) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d))
    else sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    /* storage unavailable: the draft just won't survive a reload */
  }
}

export default function Setup() {
  const { user, challenge, creativeToday, dayCloses, startChallenge, loading } = useApp()
  const router = useRouter()
  const [step, setStep] = useState(0)

  const [medium, setMedium] = useState<Medium>('mixed')
  const [rules, setRules] = useState<Rule[]>(() =>
    DEFAULT_RULES.map((r) => ({ ...r })),
  )
  // Classic by default: it's the format's own rule, and the one that makes
  // the stakes real. Grace and Extend are there for a gentler run.
  const [policy, setPolicy] = useState<MissPolicy>('classic')
  const [startChoice, setStartChoice] = useState<'today' | 'future'>('today')
  const [futureDate, setFutureDate] = useState('')
  const [why, setWhy] = useState('')

  const [error, setError] = useState<string | null>(null)

  // The draft outlives a reload or an evicted tab (setup is the most typing
  // in the app, often on a phone): kept for this tab until Start.
  const [restored, setRestored] = useState(false)
  useEffect(() => {
    const d = readDraft()
    if (d) {
      /* eslint-disable react-hooks/set-state-in-effect -- restoring a saved draft once, after mount */
      setStep(d.step)
      setMedium(d.medium)
      setRules(d.rules)
      setPolicy(d.policy)
      setStartChoice(d.startChoice)
      setFutureDate(d.futureDate)
      setWhy(d.why)
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    setRestored(true)
  }, [])
  useEffect(() => {
    if (restored) writeDraft({ step, medium, rules, policy, startChoice, futureDate, why })
  }, [restored, step, medium, rules, policy, startChoice, futureDate, why])

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

  // Next and Start stay focusable while blocked (aria-disabled): pressing
  // one goes to what's blocking it, so the reason is never out of reach.
  const dateRef = useRef<HTMLInputElement>(null)
  function showProblem() {
    const nameless = rules.find((r) => r.name.trim() === '')
    const target =
      nameless ? document.getElementById(ruleNameId(nameless))
      : !rules.some((r) => r.required) && rules[0] ? document.getElementById(ruleRequiredId(rules[0]))
      : step === 2 && startChoice === 'future' && !futureDate ? dateRef.current
      : null
    target?.focus()
    target?.scrollIntoView({ block: 'center' })
  }

  const firstDay = startChoice === 'today' ? creativeToday : futureDate
  const lastDay = firstDay ? addDays(firstDay, 74) : ''

  function finish() {
    if (!canFinish) return showProblem()
    try {
      startChallenge(draft)
      writeDraft(null)
      router.push('/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the challenge.')
    }
  }

  return (
    <main className="setup">
      {/* A way out for anyone without a challenge (a first visit, or one
          just ended): Settings has export and sign-out. */}
      <nav className="page-nav" aria-label="Main">
        <Link href="/" className="wordmark font-display brand">
          75 Create
        </Link>
        <Link href="/settings" className="back-link">
          Settings
        </Link>
      </nav>
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
            Start from the default five or make them yours — 3 to 7 rules. These
            lock once you begin.
          </p>
          <RuleEditor rules={rules} onChange={setRules} />
          {/* Always mounted, so a new problem is announced as it appears;
              right above the button it holds back. */}
          <p className="form-hint font-mono" role="status" id="rules-problem">
            {problem ?? ''}
          </p>
          <div className="nav-row">
            <button className="btn btn-ghost" onClick={() => go(0)}>
              Back
            </button>
            <button
              className="btn"
              onClick={() => (canFinish ? go(2) : showProblem())}
              aria-disabled={!canFinish}
              aria-describedby="rules-problem"
            >
              Next: stakes
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="pane">
          <h1 className="font-display setup-h1" ref={headingRef} tabIndex={-1}>
            Set your stakes
          </h1>

          <div className="policy-choices">
            {POLICY_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className={`policy-pick ${policy === id ? 'sel' : ''}`}
                onClick={() => setPolicy(id)}
                aria-pressed={policy === id}
              >
                <span className="pname font-display">{POLICY_NAMES[id]}</span>
                <span className="pline">{POLICY_PITCHES[id]}</span>
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
                  ref={dateRef}
                  type="date"
                  className="field-input date"
                  aria-label="Start date"
                  aria-describedby="stakes-problem"
                  aria-invalid={!futureDate}
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

          {/* Last look before it locks: what Start commits to, in one place. */}
          <div className="lock-summary panel" aria-labelledby="lock-title">
            <h2 className="font-display lock-h2" id="lock-title">
              What you’re locking in
            </h2>
            <ul className="lock-list">
              <li>
                {rules.length} daily rules, {rules.filter((r) => r.required).length} required to make
                a day:
                <ol className="lock-rules">
                  {rules.map((r) => (
                    <li key={r.id}>
                      {r.name.trim() || 'A rule with no name yet'}
                      {r.required ? '' : ' (optional)'}
                    </li>
                  ))}
                </ol>
              </li>
              <li>
                {POLICY_NAMES[policy]}: {POLICY_PITCHES[policy]}
              </li>
              <li>
                {!firstDay ? (
                  'Day 1: pick a date above'
                ) : (
                  <>
                    Day 1 is {startChoice === 'today' ? 'today, ' : ''}
                    {longDay(firstDay)}; Day 75 is {longDay(lastDay)}
                    {policy === 'extend' ? ', or later if a miss adds a day' : ''}
                  </>
                )}
              </li>
              {dayCloses && (
                <li>
                  {dayCloses === '00:00'
                    ? 'Each day closes at midnight (Settings can give late-night work a few hours past it)'
                    : <>
                        Each day stays open until {clockTime(dayCloses)}, so late-night work counts
                        {startChoice === 'today' ? ' (today included)' : ''}
                      </>}
                </li>
              )}
            </ul>
          </div>

          {/* What still blocks Start, said politely as it changes; a failure
              to start is the one thing worth interrupting for. */}
          <p className="form-hint font-mono" role="status" id="stakes-problem">
            {error ? '' : (problem ?? '')}
          </p>
          <div className="nav-row">
            <button className="btn btn-ghost" onClick={() => go(1)}>
              Back
            </button>
            <button
              className="btn"
              onClick={finish}
              aria-disabled={!canFinish}
              aria-describedby="stakes-problem"
            >
              Start my 75
            </button>
          </div>
          {error && (
            <p className="form-hint font-mono" role="alert">
              {error}
            </p>
          )}
        </section>
      )}

      <style jsx>{`
        /* Empty, it takes no room but stays in the accessibility tree, so
           the live region is there before its first message. */
        .form-hint:empty {
          margin: 0;
        }
        .form-hint {
          margin: 1.75rem 0 0;
          font-size: 0.75rem;
          color: var(--coral-ink);
          text-align: right;
        }
        /* A hint sits right above the button it holds back. */
        .form-hint:not(:empty) + .nav-row {
          margin-top: 0.75rem;
        }
        .setup {
          max-width: 640px;
          padding-top: 1rem;
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
          /* Two across where they fit; one column at large text. */
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
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
          min-width: 0;
          overflow-wrap: anywhere;
          text-align: left;
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
          color: var(--ink-soft);
        }
        /* Cobalt is "made": only the chosen medium carries it. */
        .media.sel :global(.glyph) {
          color: var(--cobalt);
        }
        .nav-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          margin-top: 2.5rem;
          gap: 1rem;
        }
        .lock-summary {
          margin-top: 2rem;
          padding: 1.25rem 1.5rem;
        }
        .lock-h2 {
          font-size: 1.25rem;
          margin: 0 0 0.6rem;
        }
        .lock-rules {
          margin: 0.35rem 0 0;
          padding-left: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .lock-list {
          margin: 0;
          padding-left: 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          line-height: 1.5;
          color: var(--ink-soft);
          max-width: 60ch;
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
