'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/components/AppProvider'
import { RuleEditor } from '@/components/RuleEditor'
import { newId } from '@/lib/repository'
import {
  Challenge,
  DEFAULT_RULES,
  Medium,
  MissPolicy,
  Rule,
} from '@/lib/types'

const MEDIA: { id: Medium; label: string; glyph: string }[] = [
  { id: 'writing', label: 'Writing', glyph: '✍' },
  { id: 'drawing', label: 'Drawing', glyph: '✎' },
  { id: 'music', label: 'Music', glyph: '♪' },
  { id: 'photography', label: 'Photography', glyph: '◉' },
  { id: 'video', label: 'Video', glyph: '▶' },
  { id: 'code', label: 'Code / generative', glyph: '⌘' },
  { id: 'mixed', label: 'Mixed', glyph: '✦' },
  { id: 'other', label: 'Other', glyph: '◇' },
]

const POLICIES: { id: MissPolicy; name: string; line: string }[] = [
  { id: 'classic', name: 'Classic', line: 'Any missed day restarts you at Day 1.' },
  { id: 'grace', name: 'Grace', line: 'Three skip tokens for life. A fourth miss resets.' },
  { id: 'extend', name: 'Extend', line: 'A missed day adds a day to the end. Streak resets, challenge continues.' },
]

function todayIso(tz: string): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const g = (t: string) => p.find((x) => x.type === t)!.value
  return `${g('year')}-${g('month')}-${g('day')}`
}

export default function Setup() {
  const { user, repo, refresh, loading } = useApp()
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

  const tz = user?.tz ?? 'UTC'

  useEffect(() => {
    if (!loading && !user) router.replace('/signin')
  }, [loading, user, router])

  const canFinish = useMemo(
    () => rules.length >= 3 && rules.every((r) => r.name.trim().length > 0),
    [rules],
  )

  function finish() {
    if (!canFinish) return
    const startDate =
      startChoice === 'today' || !futureDate ? todayIso(tz) : futureDate
    const challenge: Challenge = {
      id: newId(),
      medium,
      rules,
      missPolicy: policy,
      startDate,
      status: 'active',
      skipTokensUsed: 0,
      whyNote: why.trim(),
      createdAt: new Date().toISOString(),
      maintenanceMode: false,
      extraDays: 0,
    }
    repo.saveChallenge(challenge)
    refresh()
    router.push('/dashboard')
  }

  return (
    <main className="setup">
      <div className="steps font-mono">
        {['Medium', 'Rules', 'Stakes'].map((s, i) => (
          <span key={s} className={`step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}>
            {String(i + 1).padStart(2, '0')} {s}
          </span>
        ))}
      </div>

      {step === 0 && (
        <section className="pane">
          <span className="eyebrow">Step one</span>
          <h1 className="font-display setup-h1">What are you making?</h1>
          <p className="sub">This just tailors the wording. You can mix media freely.</p>
          <div className="media-grid">
            {MEDIA.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`media ${medium === m.id ? 'sel' : ''}`}
                onClick={() => setMedium(m.id)}
              >
                <span className="glyph">{m.glyph}</span>
                {m.label}
              </button>
            ))}
          </div>
          <div className="nav-row">
            <span />
            <button className="btn" onClick={() => setStep(1)}>
              Next: rules
            </button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="pane">
          <span className="eyebrow">Step two</span>
          <h1 className="font-display setup-h1">Your daily rules</h1>
          <p className="sub">
            Start from the default five or make them yours — 3 to 7 tasks. These
            lock once you begin.
          </p>
          <RuleEditor rules={rules} onChange={setRules} />
          <div className="nav-row">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>
              Back
            </button>
            <button className="btn" onClick={() => setStep(2)} disabled={!canFinish}>
              Next: stakes
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="pane">
          <span className="eyebrow">Step three</span>
          <h1 className="font-display setup-h1">Set your stakes</h1>

          <div className="policy-choices">
            {POLICIES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`policy-pick ${policy === p.id ? 'sel' : ''}`}
                onClick={() => setPolicy(p.id)}
              >
                <span className="pname font-display">{p.name}</span>
                <span className="pline">{p.line}</span>
              </button>
            ))}
          </div>
          <p className="lock-note font-mono">This choice locks when you start. Choose honestly.</p>

          <div className="start-block">
            <span className="field-label font-mono">Start date</span>
            <div className="start-row">
              <button
                type="button"
                className={`chip ${startChoice === 'today' ? 'sel' : ''}`}
                onClick={() => setStartChoice('today')}
              >
                Today
              </button>
              <button
                type="button"
                className={`chip ${startChoice === 'future' ? 'sel' : ''}`}
                onClick={() => setStartChoice('future')}
              >
                Pick a date
              </button>
              {startChoice === 'future' && (
                <input
                  type="date"
                  className="date"
                  value={futureDate}
                  min={todayIso(tz)}
                  onChange={(e) => setFutureDate(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="why-block">
            <span className="field-label font-mono">Why are you starting?</span>
            <p className="why-hint">
              We&apos;ll show this back to you on the hard days. One or two lines.
            </p>
            <textarea
              className="why-input"
              rows={3}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Because I want to finish something for once…"
            />
          </div>

          <div className="nav-row">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="btn" onClick={finish} disabled={!canFinish}>
              Start my 75 →
            </button>
          </div>
        </section>
      )}

      <style jsx>{`
        .setup {
          max-width: 640px;
          padding-top: 2rem;
        }
        .steps {
          display: flex;
          gap: 1rem;
          font-size: 0.7rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }
        .step.on {
          color: var(--coral);
        }
        .step.done {
          color: var(--ink);
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
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }
        .media {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.1rem;
          border-radius: 12px;
          border: 1.5px solid var(--line);
          background: var(--paper-2);
          color: var(--ink);
          font-family: var(--font-body);
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .media:hover {
          border-color: var(--ink-soft);
        }
        .media.sel {
          border-color: var(--cobalt);
          box-shadow: 3px 4px 0 var(--cobalt);
        }
        .glyph {
          font-size: 1.3rem;
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
          border-radius: 12px;
          border: 1.5px solid var(--line);
          background: var(--paper-2);
          cursor: pointer;
          color: var(--ink);
          transition: all 0.12s ease;
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
          font-size: 0.92rem;
        }
        .lock-note {
          font-size: 0.72rem;
          color: var(--muted);
          margin: 0.9rem 0 2rem;
        }
        .field-label {
          font-size: 0.7rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          display: block;
        }
        .start-row {
          display: flex;
          gap: 0.6rem;
          margin-top: 0.6rem;
          flex-wrap: wrap;
          align-items: center;
        }
        .chip {
          padding: 0.55rem 1rem;
          border-radius: 999px;
          border: 1.5px solid var(--line);
          background: var(--paper-2);
          color: var(--ink);
          cursor: pointer;
          font-family: var(--font-mono);
          font-size: 0.8rem;
        }
        .chip.sel {
          border-color: var(--cobalt);
          background: color-mix(in srgb, var(--cobalt) 12%, var(--paper-2));
        }
        .date {
          font-family: var(--font-body);
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          border: 1.5px solid var(--line);
          background: var(--paper);
          color: var(--ink);
        }
        .start-block,
        .why-block {
          margin-top: 2rem;
        }
        .why-hint {
          color: var(--muted);
          font-size: 0.85rem;
          margin: 0.4rem 0 0.7rem;
        }
        .why-input {
          width: 100%;
          font-family: var(--font-body);
          font-size: 1rem;
          padding: 0.85rem 1rem;
          border-radius: 10px;
          border: 1.5px solid var(--line);
          background: var(--paper);
          color: var(--ink);
          resize: vertical;
        }
        .why-input:focus {
          outline: none;
          border-color: var(--cobalt);
        }
      `}</style>
    </main>
  )
}
