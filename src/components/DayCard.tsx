'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DayData, checkKey } from '@/lib/repository'
import { Challenge, MAX_LOG_CHARS, Rule } from '@/lib/types'
import {
  Stakes,
  ToggleResult,
  completionRules,
  evidenceOf,
  milestoneAt,
  ruleMet,
} from '@/lib/challengeSession'
import { POLICY_LINES, POLICY_NAMES, clockTime, longDay, milestoneCopy } from '@/lib/format'
import Link from 'next/link'
import { useApp } from './AppProvider'
import { LogDraft, MomentHold, createLogDraft, createMomentHold } from '@/lib/logDraft'
import { ArtifactInput } from './ArtifactInput'
import { Icon } from './Icon'

interface Props {
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

/** The check-in card's id: the skip link, and where focus lands after a state change. */
export const CHECK_IN_ID = 'check-in'

export function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

/** How long a writer pauses, after the log completed the day, before the moment plays. */
const CELEBRATION_PAUSE_MS = 1500
/** How long typing pauses before the log is saved. */
const LOG_SAVE_DELAY_MS = 600

/** Whole minutes until `iso`, refreshed every 20s; null when it's unknown or passed. */
function useMinutesLeft(iso: string): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000)
    return () => clearInterval(t)
  }, [])
  const at = Date.parse(iso)
  if (!iso || Number.isNaN(at) || at <= now) return null
  return Math.ceil((at - now) / 60_000)
}

export function DayCard({
  challenge,
  dayIndex,
  dayData,
  creativeToday,
  dayCloses,
  stakes,
  maintenance = false,
  onComplete,
}: Props) {
  const { toggleRule, saveLog, derived, supabaseEnabled, dayClosesAt } = useApp()
  const totalDays = derived.totalDays
  const completed = !maintenance && Boolean(dayData.completions[dayIndex])
  // The log's draft (see lib/logDraft): seeded from storage, saved after a
  // pause, flushed when the page hides, and it takes in a log synced from
  // elsewhere only when nothing typed here is waiting to be saved.
  const storedLog = dayData.logs[dayIndex]?.text ?? ''
  const [log, setLog] = useState(storedLog)
  const [savedFlash, setSavedFlash] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The latest ways to save and to celebrate, for the long-lived draft and hold. */
  const saveNow = useRef<(text: string) => void>(() => {})
  const celebrate = useRef<() => void>(() => {})
  /** Built once the card mounts; only event handlers and effects use them. */
  const draft = useRef<LogDraft | null>(null)
  const celebrationHold = useRef<MomentHold | null>(null)
  const firstStoredLog = useRef(storedLog)
  const logRef = useRef<HTMLTextAreaElement>(null)
  const ruleRefs = useRef<Record<string, HTMLElement | null>>({})
  const [announce, setAnnounce] = useState('')
  const [notesShown, toggleNotes] = useRuleNotes(dayIndex)
  const howRef = useRef<HTMLDetailsElement>(null)
  const cardRef = useRef<HTMLElement>(null)

  // The header's policy label links here: open the explainer on arrival.
  useEffect(() => {
    const open = () => {
      if (window.location.hash === '#how-today' && howRef.current) {
        howRef.current.open = true
        howRef.current.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true })
      }
    }
    open()
    window.addEventListener('hashchange', open)
    return () => window.removeEventListener('hashchange', open)
  }, [])

  const rules = useMemo(() => (maintenance ? [] : challenge.rules), [maintenance, challenge.rules])
  const logRule = rules.find((r) => evidenceOf(r) === 'log')
  const artifactRule = rules.find((r) => evidenceOf(r) === 'artifact')
  const needed = maintenance ? [] : completionRules(challenge)
  // The log rule counts what's typed (see `shownMet` below), so the count
  // and the row never disagree while a save is in flight.
  const metCount = needed.filter((r) =>
    evidenceOf(r) === 'log' ? log.trim().length > 0 : ruleMet(r, dayData, dayIndex),
  ).length

  // Never lose a log: flush any debounced save on unmount (navigation,
  // rollover) and the moment the page is hidden or closed (a swiped-away tab,
  // a locked phone, a reload), which never unmounts anything. The session
  // files it under the day it was typed for.
  useEffect(() => {
    const log = createLogDraft({
      initial: firstStoredLog.current,
      maxChars: MAX_LOG_CHARS,
      delayMs: LOG_SAVE_DELAY_MS,
      save: (text) => saveNow.current(text),
      // The visible "Saved" is described by the field; only a change to the
      // day itself is worth interrupting a screen reader for.
      onSaved: () => {
        setSavedFlash(true)
        if (flashTimer.current) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setSavedFlash(false), 1600)
      },
    })
    const hold = createMomentHold({ pauseMs: CELEBRATION_PAUSE_MS, play: () => celebrate.current() })
    draft.current = log
    celebrationHold.current = hold
    const flush = () => log.flush()
    const onHidden = () => {
      if (document.visibilityState === 'hidden') log.flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHidden)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      hold.cancel()
      log.dispose()
    }
  }, [])

  // One always-present live region speaks for the card: completion, a day
  // that came back off the grid, rule toggles. (A region that mounts with its
  // text already inside, like the celebration, is often never read.)
  const handle = useCallback(
    (result: ToggleResult) => {
      if (!result.ok) return false
      if (result.justCompleted) {
        // The celebration is visual only; a milestone or the finish is said
        // here, so the celebrationHold isn't silent for a screen reader.
        const m = milestoneAt(dayIndex, totalDays)
        const moment = m ? ` ${milestoneCopy(m, dayIndex, totalDays).title}` : ''
        setAnnounce(`Day ${dayIndex}, made.${moment}${m === 'final' ? ' Your recap is ready.' : ''}`)
        // Finished by the log while still writing it: the stamp and the
        // announcement land now, the full-screen moment once they stop.
        if (document.activeElement === logRef.current) celebrationHold.current?.hold()
        else onComplete(dayIndex)
        return true
      }
      if (result.reopened) {
        celebrationHold.current?.cancel()
        setAnnounce(`Day ${dayIndex} is no longer complete.`)
        return true
      }
      return false
    },
    [dayIndex, totalDays, onComplete],
  )

  useEffect(() => {
    saveNow.current = (text) => handle(saveLog(dayIndex, text))
    celebrate.current = () => onComplete(dayIndex)
  }, [handle, saveLog, dayIndex, onComplete])

  // Take in a log that changed in storage without being typed here.
  useEffect(() => {
    const shown = draft.current?.stored(storedLog) ?? null
    if (shown !== null) setLog(shown)
  }, [storedLog])

  const toggle = useCallback(
    (rule: Rule) => {
      const evidence = evidenceOf(rule)
      if (evidence === 'log') return logRef.current?.focus()
      if (evidence === 'artifact') {
        return ruleRefs.current[rule.id]?.querySelector<HTMLElement>('button, input')?.focus()
      }
      const was = dayData.checks[checkKey(dayIndex, rule.id)] === true
      const result = toggleRule(dayIndex, rule.id)
      if (result.ok && !result.justCompleted && !result.reopened) {
        setAnnounce(`${rule.name}: ${was ? 'unchecked' : 'done'}.`)
      }
      handle(result)
    },
    [dayData.checks, dayIndex, handle, toggleRule],
  )

  // Keyboard accelerators: 1–7 tick (or jump to) a rule, N jumps to the log.
  // Live only while focus is inside this card and not in a field, so a stray
  // digit (or a speech command) elsewhere can never change the day.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isTyping(e.target) && cardRef.current?.contains(e.target as Node)) {
        // Step out of the field onto its rule row, still inside the card, so
        // the next digit or Tab carries on from here (the text is saved).
        const row = (e.target as HTMLElement).closest<HTMLElement>('[data-rule-row]')
        ;(row ?? cardRef.current)?.focus({ preventScroll: true })
        return
      }
      // Tab from a rule row that Esc landed on carries on past that row's
      // own fields, so "leave a field, then Tab" doesn't go straight back in.
      const active = document.activeElement as HTMLElement | null
      if (e.key === 'Tab' && !e.shiftKey && active?.hasAttribute('data-rule-row') && cardRef.current) {
        const next = [
          ...cardRef.current.querySelectorAll<HTMLElement>(
            'button, a[href], input:not([type=file]), textarea, summary',
          ),
        ].find(
          (el) =>
            !active.contains(el) &&
            el.offsetParent !== null &&
            active.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
        )
        if (next) {
          e.preventDefault()
          next.focus()
        }
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (!cardRef.current?.contains(document.activeElement)) return
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
    setLog(draft.current?.type(clipped) ?? clipped)
    // Still writing: a held celebration waits for the next pause.
    celebrationHold.current?.typing()
  }


  const artifacts = dayData.artifacts[dayIndex] ?? []
  const closes = clockTime(dayCloses)
  const closingIn = useMinutesLeft(dayClosesAt)
  // The last hour of an unmade day is the one moment a glance should change
  // what someone does: say how long is left, plainly, once.
  const closing = !completed && !maintenance && closingIn !== null && closingIn <= 60
  const toldClosing = useRef(false)
  useEffect(() => {
    if (!closing || toldClosing.current) return
    toldClosing.current = true
    setAnnounce(`Today closes in ${closingIn} ${closingIn === 1 ? 'minute' : 'minutes'}.`)
  }, [closing, closingIn])

  const logField = (labelId: string, statusId?: string) => (
    <div className="field">
      <textarea
        ref={logRef}
        id={`log-${dayIndex}`}
        className="field-input log-input"
        rows={3}
        value={log}
        maxLength={MAX_LOG_CHARS}
        aria-labelledby={labelId}
        aria-describedby={[statusId, `log-count-${dayIndex}`].filter(Boolean).join(' ')}
        placeholder="What did you make or learn today?"
        onChange={(e) => onLogChange(e.target.value)}
        onBlur={() => celebrationHold.current?.release()}
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

  // Inside an evidence row the row is already the named group: the field
  // doesn't name a second one the same (`nested`).
  const artifactField = (labelId: string, describedBy?: string, nested = false) => (
    <ArtifactInput
      dayIndex={dayIndex}
      artifacts={artifacts}
      onResult={handle}
      onAnnounce={setAnnounce}
      labelledBy={nested ? undefined : labelId}
      describedBy={describedBy}
      uploadId={`upload-${dayIndex}`}
    />
  )

  return (
    <section
      ref={cardRef}
      id={CHECK_IN_ID}
      className={`daycard panel ${completed ? 'done' : ''}`}
      aria-labelledby={`dc-title-${dayIndex}`}
      // Wherever focus lands on the card (a reset, maintenance, the skip
      // link), it says which day and what's left, not just the date.
      aria-describedby={`dc-meta-${dayIndex}`}
      tabIndex={-1}
    >
      <header className="daycard-head">
        <div className="head-text">
          <h2 id={`dc-title-${dayIndex}`} className="font-display dc-h2">
            {longDay(creativeToday)}
          </h2>
          <p id={`dc-meta-${dayIndex}`} className="dc-meta">
            {maintenance
              ? `Day ${dayIndex} · maintenance: log what you made, no rules`
              : completed
                ? `Day ${dayIndex} is on the grid`
                : <>
                    <span className="sr-only">Day {dayIndex}: </span>
                    {metCount} of {needed.length} done ·{' '}
                    {closing ? (
                      <span className="closing">
                        closes in {closingIn} {closingIn === 1 ? 'minute' : 'minutes'}
                      </span>
                    ) : (
                      `open until ${closes}`
                    )}
                  </>}
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
              // A button's contents aren't read as a description: point at the
              // note explicitly so what counts is heard, not only seen.
              const descId = notesShown && r.description ? `${labelId}-desc` : undefined
              const body = (
                <span className="check-body">
                  <span className="check-name" id={labelId}>
                    {r.name}
                    {!r.required && <span className="opt"> · optional</span>}
                  </span>
                  {descId && (
                    <span className="check-desc" id={descId}>
                      {r.description}
                    </span>
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
                      aria-describedby={descId}
                      aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
                    >
                      {box}
                      {body}
                      {i < 9 && <kbd className="key" aria-hidden>{i + 1}</kbd>}
                    </button>
                  </li>
                )
              }
              const statusId = `${labelId}-status`
              // The log rule follows what's typed, not the debounced save, so
              // it never looks unmet while the words are on screen.
              const shownMet = evidence === 'log' ? log.trim().length > 0 : met
              // Clearing the log of a made day is the one status that warns.
              const warns = !shownMet && evidence === 'log' && completed
              const status = shownMet
                ? 'Done'
                : warns
                  ? 'Clearing the log reopens today'
                  : evidence === 'log'
                    ? 'Write a line below'
                    : 'Add an image or a link'
              const head = (
                <>
                  <span className={`box ${shownMet ? 'on' : ''}`} aria-hidden>
                    {shownMet && <Icon name="check" size={16} />}
                  </span>
                  <span className="check-body">
                    <span className="check-name" id={labelId}>
                      {r.name}
                      {!r.required && <span className="opt"> · optional</span>}
                    </span>
                    <span className={`status ${warns ? 'warn' : ''}`} id={statusId}>
                      {status}
                    </span>
                    {descId && (
                      <span className="check-desc" id={descId}>
                        {r.description}
                      </span>
                    )}
                  </span>
                  {i < 9 && <kbd className="key" aria-hidden>{i + 1}</kbd>}
                </>
              )
              return (
                <li key={r.id}>
                  <div
                    className={`check evidence ${shownMet ? 'on' : ''}`}
                    data-rule-row
                    tabIndex={-1}
                    role="group"
                    aria-labelledby={labelId}
                    ref={(el) => {
                      ruleRefs.current[r.id] = el
                    }}
                  >
                    {evidence === 'log' ? (
                      <label className="evidence-head" htmlFor={`log-${dayIndex}`}>
                        {head}
                      </label>
                    ) : (
                      // Not a <label>: that would rename the Upload button to
                      // this whole row. A click still lands on the controls.
                      <div
                        className="evidence-head"
                        onClick={() => document.getElementById(`upload-${dayIndex}`)?.focus()}
                      >
                        {head}
                      </div>
                    )}
                    {evidence === 'log'
                      ? logField(labelId, [statusId, descId].filter(Boolean).join(' '))
                      : artifactField(labelId, descId, true)}
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
              In this card: <kbd>1</kbd>–<kbd>{Math.min(rules.length, 9)}</kbd> rules · <kbd>N</kbd>{' '}
              log · <kbd>Esc</kbd> leave a field
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
        <details className="howto" id="how-today" ref={howRef}>
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
              Today stays open until {closes}, so late-night work still counts. Change the cut-off in{' '}
              <Link href="/settings" className="inline-link">
                Settings
              </Link>
              .
            </li>
            {stakes && (
              <li>
                <strong>{POLICY_NAMES[stakes.policy]}:</strong> {POLICY_LINES[stakes.policy]}
              </li>
            )}
            <li>
              {supabaseEnabled
                ? 'Everything saves as you go, on this device and to your account, so your other devices have it too.'
                : 'Everything saves as you go, and stays on this device unless you share it.'}
            </li>
          </ul>
        </details>
      )}

      <p className="sr-only" aria-live="polite" role="status">
        {announce}
      </p>

      <style jsx>{`
        .daycard {
          position: relative;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        @media (max-width: 26em) {
          /* A phone, or large text: nested paddings give way to the words. */
          /* Held to the viewport, so they don't double with the text. */
          .daycard {
            padding: min(1rem, 4vw);
          }
          .daycard :global(.check) {
            padding: min(0.7rem, 3vw) min(0.75rem, 3vw);
            gap: min(0.6rem, 2.5vw);
          }
          /* Evidence rows line up with the plain rules above them. */
          .daycard .evidence-head {
            gap: min(0.6rem, 2.5vw);
          }
        }
        .daycard:focus:not(:focus-visible) {
          outline: none;
        }
        .daycard.done {
          box-shadow: 4px 5px 0 var(--cobalt);
        }
        .daycard-head {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }
        .head-text {
          /* Let a long date wrap instead of widening the card. */
          min-width: 0;
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
        /* A stake, so coral-ink: stated, not flashing. */
        .closing {
          color: var(--coral-ink);
          font-weight: 700;
        }
        .stamp {
          /* Pressed onto the card's corner, over its edge like a rubber stamp,
             so landing it never re-wraps the date beneath. */
          position: absolute;
          top: -0.85rem;
          right: 1.25rem;
          background: var(--paper-2);
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
        @media (max-width: 26em) {
          /* Large text or a narrow phone: the stamp would cover the date, so
             it takes its own line above it instead of the card's corner. */
          .stamp {
            position: static;
            order: -1;
            margin-bottom: -0.25rem;
          }
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
          cursor: pointer;
        }
        .status {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--muted);
        }
        .check.on .status {
          color: var(--cobalt);
        }
        .status.warn {
          color: var(--coral-ink);
        }
        .evidence:focus {
          outline: none;
        }
        .evidence:focus-visible {
          outline: 3px solid var(--cobalt);
          outline-offset: 2px;
        }
        .box {
          flex: none;
          width: 1.5rem;
          height: 1.5rem;
          border-radius: 4px;
          border: 1.5px solid var(--muted);
          display: grid;
          place-items: center;
          color: var(--paper);
          margin-top: 1px;
        }
        /* A 44px hit area around an inline link, without moving the text. */
        .daycard :global(.inline-link) {
          display: inline-block;
          padding: 0.75rem 0.25rem;
          margin: -0.75rem -0.25rem;
        }
        /* The tick grows with its box at large text sizes. */
        .box :global(svg) {
          width: 70%;
          height: 70%;
        }
        .evidence .box {
          border-style: dashed;
        }
        .box.on {
          background: var(--cobalt);
          border: 1.5px solid var(--cobalt);
        }
        .check-body {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          flex: 1;
          min-width: 0;
          /* A rule name longer than a narrow card (large text on a small
             phone) breaks rather than pushing the page sideways. */
          overflow-wrap: anywhere;
          hyphens: auto;
        }
        .check-name {
          font-weight: 600;
          font-size: 1rem;
        }
        .opt {
          font-weight: 400;
          font-size: 0.875rem;
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
          display: flex;
          justify-content: flex-end;
          margin-top: 0.35rem;
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
          line-height: 1.5;
          padding: 0.8rem 1rem;
          background: var(--paper-2);
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
          font-size: 0.8rem;
          color: var(--ink-soft);
          text-decoration: underline;
          text-underline-offset: 0.25em;
          cursor: pointer;
        }
        .hint {
          font-size: 0.8rem;
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
          font-size: 0.875rem;
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
