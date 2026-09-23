'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DayData, Repository } from '@/lib/repository'
import { Challenge, MAX_LOG_CHARS, Rule } from '@/lib/types'
import { Stakes, ToggleResult, completionRules, evidenceOf, ruleMet } from '@/lib/challengeSession'
import { POLICY_LINES, POLICY_NAMES, clockTime, longDay } from '@/lib/format'
import { useApp } from './AppProvider'
import { ArtifactInput } from './ArtifactInput'
import { Icon } from './Icon'

interface Props {
  repo: Repository
  challenge: Challenge
  dayIndex: number
  dayData: DayData
  /** Today's creative date (YYYY-MM-DD). */
  creativeToday: string
  /** Local "HH:MM" when the creative day closes. */
  dayCloses: string
  stakes: Stakes | null
  /** Maintenance: a daily log and artifact with no rules to check. */
  maintenance?: boolean
  onComplete: (dayIndex: number) => void
}

const NOTES_KEY = '75create.ruleNotes'

/** Whether to show each rule's description: on for the first days, then the
 *  person's own choice (they've read them by Day 4). */
function useRuleNotes(dayIndex: number): [boolean, () => void] {
  const [pref, setPref] = useState<'on' | 'off' | null>(null)
  useEffect(() => {
    try {
      const v = localStorage.getItem(NOTES_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v === 'on' || v === 'off') setPref(v)
    } catch {
      /* default applies */
    }
  }, [])
  const shown = pref ? pref === 'on' : dayIndex <= 3
  const toggle = () => {
    const next = shown ? 'off' : 'on'
    setPref(next)
    try {
      localStorage.setItem(NOTES_KEY, next)
    } catch {
      /* preference just won't persist */
    }
  }
  return [shown, toggle]
}

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

export function DayCard({
  repo,
  challenge,
  dayIndex,
  dayData,
  creativeToday,
  dayCloses,
  stakes,
  maintenance = false,
  onComplete,
}: Props) {
  const { toggleTask, saveLog, attachImage, attachLink, removeArtifact } = useApp()
  const completed = !maintenance && Boolean(dayData.completions[dayIndex])
  // Seeded from storage once. It is deliberately NOT re-synced from `dayData`:
  // an autosave round-trip re-reads storage, and copying that back into the
  // textarea would drop characters typed while the save was in flight. The
  // dashboard mounts one card per day (`key={dayIndex}`), so a day rollover
  // still picks up the stored log.
  const [log, setLog] = useState(dayData.logs[dayIndex]?.text ?? '')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Pending debounced write, run immediately if the card goes away first. */
  const pendingSave = useRef<(() => void) | null>(null)
  const logRef = useRef<HTMLTextAreaElement>(null)
  const ruleRefs = useRef<Record<string, HTMLElement | null>>({})
  const [savedFlash, setSavedFlash] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [notesShown, toggleNotes] = useRuleNotes(dayIndex)

  const rules = useMemo(() => (maintenance ? [] : challenge.rules), [maintenance, challenge.rules])
  const logRule = rules.find((r) => evidenceOf(r) === 'log')
  const artifactRule = rules.find((r) => evidenceOf(r) === 'artifact')
  const needed = maintenance ? [] : completionRules(challenge)
  const metCount = needed.filter((r) => ruleMet(r, dayData, dayIndex)).length

  // Never lose a log to navigation or rollover: flush any debounced save on
  // unmount. The session files it under the day it was typed for.
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      pendingSave.current?.()
      pendingSave.current = null
    },
    [],
  )

  const handle = useCallback(
    (result: ToggleResult) => {
      if (result.ok && result.justCompleted) {
        setAnnounce(`Day ${dayIndex} complete.`)
        onComplete(dayIndex)
      }
    },
    [dayIndex, onComplete],
  )

  const toggle = useCallback(
    (rule: Rule) => {
      const evidence = evidenceOf(rule)
      if (evidence === 'log') return logRef.current?.focus()
      if (evidence === 'artifact') {
        return ruleRefs.current[rule.id]?.querySelector<HTMLElement>('button, input')?.focus()
      }
      const was = dayData.checks[`${dayIndex}:${rule.id}`] === true
      const result = toggleTask(dayIndex, rule.id)
      if (result.ok && !result.justCompleted) setAnnounce(`${rule.name}: ${was ? 'unchecked' : 'done'}.`)
      handle(result)
    },
    [dayData.checks, dayIndex, handle, toggleTask],
  )

  // Keyboard accelerators, off while typing: 1–7 tick (or jump to) a rule,
  // N jumps to the log.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= rules.length) {
        e.preventDefault()
        toggle(rules[n - 1])
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        logRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [rules, toggle])

  function onLogChange(value: string) {
    const clipped = value.slice(0, MAX_LOG_CHARS)
    setLog(clipped)
    const write = () => handle(saveLog(dayIndex, clipped))
    pendingSave.current = write
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      write()
      pendingSave.current = null
      setSavedFlash(true)
      setAnnounce('Log saved.')
      if (flashTimer.current) clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setSavedFlash(false), 1600)
    }, 600)
  }

  const artifacts = dayData.artifacts[dayIndex] ?? []
  const closes = clockTime(dayCloses)

  const logField = (labelId: string) => (
    <div className="field">
      <textarea
        ref={logRef}
        id={`log-${dayIndex}`}
        className="log-input"
        rows={3}
        value={log}
        maxLength={MAX_LOG_CHARS}
        aria-labelledby={labelId}
        aria-describedby={`log-count-${dayIndex}`}
        placeholder="What did you make or learn today?"
        onChange={(e) => onLogChange(e.target.value)}
      />
      <span id={`log-count-${dayIndex}`} className={`count ${savedFlash ? 'flash' : ''}`}>
        {savedFlash ? (
          <>
            <Icon name="check" size={14} /> Saved
          </>
        ) : (
          `${log.length}/${MAX_LOG_CHARS}`
        )}
      </span>
    </div>
  )

  const artifactField = (labelId: string) => (
    <ArtifactInput
      repo={repo}
      dayIndex={dayIndex}
      artifacts={artifacts}
      attachImage={attachImage}
      attachLink={attachLink}
      removeArtifact={removeArtifact}
      onResult={handle}
      labelledBy={labelId}
    />
  )

  return (
    <section
      id="check-in"
      className={`daycard panel ${completed ? 'done' : ''}`}
      aria-labelledby={`dc-title-${dayIndex}`}
      tabIndex={-1}
    >
      <header className="daycard-head">
        <div>
          <h2 id={`dc-title-${dayIndex}`} className="font-display dc-h2">
            {longDay(creativeToday)}
          </h2>
          <p className="dc-meta">
            {maintenance
              ? `Day ${dayIndex} · maintenance: log what you made, no rules`
              : completed
                ? `Day ${dayIndex} is on the grid`
                : `${metCount} of ${needed.length} done · open until ${closes}`}
          </p>
        </div>
        {completed && (
          <span className="stamp">
            <Icon name="check" size={16} /> Done
          </span>
        )}
      </header>

      {rules.length > 0 && (
        <>
          <ol className="checks">
            {rules.map((r, i) => {
              const evidence = evidenceOf(r)
              const met = ruleMet(r, dayData, dayIndex)
              const labelId = `rule-${dayIndex}-${r.id}`
              const body = (
                <span className="check-body">
                  <span className="check-name" id={labelId}>
                    {r.name}
                    {!r.required && <span className="opt"> · optional</span>}
                  </span>
                  {notesShown && r.description && (
                    <span className="check-desc">{r.description}</span>
                  )}
                </span>
              )
              const box = (
                <span className={`box ${met ? 'on' : ''}`} aria-hidden>
                  {met && <Icon name="check" size={16} />}
                </span>
              )
              if (!evidence) {
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={`check ${met ? 'on' : ''}`}
                      onClick={() => toggle(r)}
                      aria-pressed={met}
                      aria-labelledby={labelId}
                      aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
                    >
                      {box}
                      {body}
                      {i < 9 && <kbd className="key" aria-hidden>{i + 1}</kbd>}
                    </button>
                  </li>
                )
              }
              return (
                <li key={r.id}>
                  <div
                    className={`check evidence ${met ? 'on' : ''}`}
                    ref={(el) => {
                      ruleRefs.current[r.id] = el
                    }}
                  >
                    <div className="evidence-head">
                      {box}
                      {body}
                      <span className="status">
                        {met ? 'Done' : evidence === 'log' ? 'Write a line' : 'Add one'}
                      </span>
                    </div>
                    {evidence === 'log' ? logField(labelId) : artifactField(labelId)}
                  </div>
                </li>
              )
            })}
          </ol>
          <div className="card-tools">
            <button type="button" className="text-btn" onClick={toggleNotes} aria-expanded={notesShown}>
              {notesShown ? 'Hide rule notes' : 'Show rule notes'}
            </button>
            <span className="hint">
              Keys: <kbd>1</kbd>–<kbd>{Math.min(rules.length, 9)}</kbd> tick · <kbd>N</kbd> log
            </span>
          </div>
        </>
      )}

      {!logRule && (
        <div className="field-block">
          <span className="field-label" id={`free-log-${dayIndex}`}>
            {maintenance ? "Today's log" : 'Notes'}
            {!maintenance && <span className="opt"> · optional</span>}
          </span>
          {logField(`free-log-${dayIndex}`)}
        </div>
      )}

      {!artifactRule && (
        <div className="field-block">
          <span className="field-label" id={`free-art-${dayIndex}`}>
            {maintenance ? "Today's work" : 'Artifacts'}
            {!maintenance && <span className="opt"> · optional</span>}
          </span>
          {artifactField(`free-art-${dayIndex}`)}
        </div>
      )}

      {!maintenance && (
        <details className="howto">
          <summary>
            <Icon name="info" size={18} />
            How today works
          </summary>
          <ul>
            <li>
              The day is done when {needed.length === rules.length ? 'every rule is' : 'every required rule is'} met.
              {logRule && ' Writing the log meets “' + logRule.name + '”.'}
              {artifactRule && ' Adding an image or link meets “' + artifactRule.name + '”.'}
            </li>
            <li>
              Today stays open until {closes}, so late-night work still counts. Change the cut-off in
              Settings.
            </li>
            {stakes && (
              <li>
                <strong>{POLICY_NAMES[stakes.policy]}:</strong> {POLICY_LINES[stakes.policy]}
              </li>
            )}
            <li>
              Everything saves as you go, and stays on this device unless you share it.
            </li>
          </ul>
        </details>
      )}

      <p className="sr-only" aria-live="polite" role="status">
        {announce}
      </p>

      <style jsx>{`
        .daycard {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .daycard:focus {
          outline: none;
        }
        .daycard.done {
          box-shadow: 4px 5px 0 var(--cobalt);
        }
        .daycard-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }
        .dc-h2 {
          font-size: clamp(1.5rem, 5vw, 1.9rem);
          margin: 0;
          text-wrap: balance;
        }
        .dc-meta {
          margin: 0.45rem 0 0;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--ink-soft);
        }
        .stamp {
          flex: none;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--cobalt);
          border: 1.5px solid var(--cobalt);
          border-radius: 999px;
          padding: 0.3rem 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          transform: rotate(-3deg);
        }
        .checks {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .check {
          width: 100%;
          display: flex;
          gap: 0.85rem;
          align-items: flex-start;
          text-align: left;
          background: var(--paper);
          border: 1.5px solid var(--line);
          border-radius: 10px;
          padding: 0.85rem 1rem;
          min-height: 52px;
          color: var(--ink);
          transition:
            border-color 0.12s ease,
            background-color 0.12s ease;
        }
        button.check {
          cursor: pointer;
        }
        button.check:hover {
          border-color: var(--ink-soft);
        }
        .check.on {
          border-color: var(--cobalt);
          background: color-mix(in srgb, var(--cobalt) 8%, var(--paper));
        }
        .evidence {
          flex-direction: column;
          align-items: stretch;
          gap: 0.75rem;
        }
        .evidence-head {
          display: flex;
          gap: 0.85rem;
          align-items: flex-start;
          width: 100%;
        }
        .status {
          margin-left: auto;
          flex: none;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          padding-top: 0.2rem;
        }
        .check.on .status {
          color: var(--cobalt);
        }
        .box {
          flex: none;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: 2px solid var(--muted);
          display: grid;
          place-items: center;
          color: var(--paper);
          margin-top: 1px;
        }
        .evidence .box {
          border-style: dashed;
        }
        .box.on {
          background: var(--cobalt);
          border: 2px solid var(--cobalt);
        }
        .check-body {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          flex: 1;
          min-width: 0;
        }
        .check-name {
          font-weight: 600;
          font-size: 1rem;
        }
        .opt {
          font-weight: 400;
          font-size: 0.85rem;
          color: var(--muted);
        }
        .check-desc {
          font-size: 0.875rem;
          color: var(--ink-soft);
          line-height: 1.45;
        }
        .key {
          flex: none;
          margin-left: auto;
          align-self: center;
          opacity: 0.8;
        }
        .daycard :global(.field) {
          position: relative;
          width: 100%;
        }
        .field-block {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .field-label {
          font-weight: 600;
        }
        .daycard :global(.count) {
          position: absolute;
          right: 0.7rem;
          bottom: 0.55rem;
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--muted);
          pointer-events: none;
        }
        .daycard :global(.count.flash) {
          color: var(--cobalt);
        }
        .daycard :global(.log-input) {
          display: block;
          width: 100%;
          font-family: var(--font-body);
          font-size: 1rem;
          line-height: 1.5;
          padding: 0.8rem 1rem 1.8rem;
          border-radius: 10px;
          border: 1.5px solid var(--line);
          background: var(--paper-2);
          color: var(--ink);
          resize: vertical;
        }
        .daycard :global(.log-input::placeholder) {
          color: var(--muted);
        }
        .daycard :global(.log-input:focus) {
          border-color: var(--cobalt);
        }
        .card-tools {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: -0.5rem;
        }
        .text-btn {
          background: none;
          border: 0;
          padding: 0.6rem 0;
          min-height: 44px;
          font-family: var(--font-mono);
          font-size: 0.78rem;
          color: var(--ink-soft);
          text-decoration: underline;
          text-underline-offset: 0.25em;
          cursor: pointer;
        }
        .hint {
          font-size: 0.78rem;
          color: var(--muted);
        }
        .howto {
          border-top: 1.5px dashed var(--line);
          padding-top: 0.5rem;
        }
        .howto summary {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          min-height: 44px;
          cursor: pointer;
          font-weight: 600;
          color: var(--ink-soft);
          list-style: none;
        }
        .howto summary::-webkit-details-marker {
          display: none;
        }
        .howto ul {
          margin: 0.25rem 0 0.5rem;
          padding-left: 1.2rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          color: var(--ink-soft);
          line-height: 1.5;
          font-size: 0.92rem;
          max-width: 60ch;
        }
        @media (hover: none), (pointer: coarse) {
          .key,
          .hint {
            display: none;
          }
        }
      `}</style>
    </section>
  )
}
