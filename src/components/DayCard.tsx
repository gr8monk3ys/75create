'use client'

import { useEffect, useRef, useState } from 'react'
import { DayData, Repository } from '@/lib/repository'
import { Challenge, MAX_LOG_CHARS } from '@/lib/types'
import { ArtifactInput } from './ArtifactInput'

interface Props {
  repo: Repository
  challenge: Challenge
  dayIndex: number
  dayData: DayData
  refresh: () => void
  onComplete: (dayIndex: number) => void
}

export function DayCard({
  repo,
  challenge,
  dayIndex,
  dayData,
  refresh,
  onComplete,
}: Props) {
  const cid = challenge.id
  const completed = Boolean(dayData.completions[dayIndex])
  const [log, setLog] = useState(dayData.logs[dayIndex]?.text ?? '')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  // Keep local log in sync when the day changes.
  useEffect(() => {
    setLog(dayData.logs[dayIndex]?.text ?? '')
  }, [dayIndex, dayData.logs])

  function isChecked(ruleId: string): boolean {
    return dayData.checks[`${dayIndex}:${ruleId}`] === true
  }

  function requiredAllChecked(overrides?: Record<string, boolean>): boolean {
    return challenge.rules
      .filter((r) => r.required)
      .every((r) => {
        const key = `${dayIndex}:${r.id}`
        if (overrides && key in overrides) return overrides[key]
        return dayData.checks[key] === true
      })
  }

  function toggle(ruleId: string) {
    const key = `${dayIndex}:${ruleId}`
    const next = !(dayData.checks[key] === true)
    repo.saveCheck(cid, dayIndex, ruleId, next)

    const nowAll = requiredAllChecked({ [key]: next })
    if (nowAll && !completed) {
      repo.saveDayCompletion(cid, dayIndex, new Date().toISOString())
      onComplete(dayIndex)
    } else if (!nowAll && completed) {
      repo.saveDayCompletion(cid, dayIndex, null)
    }
    refresh()
  }

  function onLogChange(value: string) {
    const clipped = value.slice(0, MAX_LOG_CHARS)
    setLog(clipped)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      repo.saveLog(cid, dayIndex, {
        dayId: `${cid}:${dayIndex}`,
        text: clipped,
        updatedAt: new Date().toISOString(),
      })
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1200)
      refresh()
    }, 600)
  }

  const artifacts = dayData.artifacts[dayIndex] ?? []

  return (
    <div className={`daycard panel ${completed ? 'done' : ''}`}>
      <div className="daycard-head">
        <div>
          <span className="eyebrow">{completed ? 'Completed' : "Today's check-in"}</span>
          <h2 className="font-display dc-h2">Day {dayIndex}</h2>
        </div>
        {completed && <span className="stamp font-mono">✓ done</span>}
      </div>

      <ul className="checks">
        {challenge.rules.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className={`check ${isChecked(r.id) ? 'on' : ''}`}
              onClick={() => toggle(r.id)}
              aria-pressed={isChecked(r.id)}
            >
              <span className="box" aria-hidden>
                {isChecked(r.id) ? '✓' : ''}
              </span>
              <span className="check-body">
                <span className="check-name">
                  {r.name}
                  {!r.required && <em className="opt font-mono"> optional</em>}
                </span>
                {r.description && <span className="check-desc">{r.description}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="field-block">
        <div className="field-head">
          <span className="field-label font-mono">Log the day</span>
          <span className={`count font-mono ${savedFlash ? 'flash' : ''}`}>
            {savedFlash ? 'saved' : `${log.length}/${MAX_LOG_CHARS}`}
          </span>
        </div>
        <textarea
          className="log-input"
          rows={2}
          value={log}
          maxLength={MAX_LOG_CHARS}
          placeholder="What did you make or learn today?"
          onChange={(e) => onLogChange(e.target.value)}
        />
      </div>

      <div className="field-block">
        <span className="field-label font-mono">Capture an artifact</span>
        <ArtifactInput
          repo={repo}
          challengeId={cid}
          dayIndex={dayIndex}
          artifacts={artifacts}
          onChange={refresh}
        />
      </div>

      <style jsx>{`
        .daycard {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .daycard.done {
          box-shadow: 4px 5px 0 var(--cobalt);
        }
        .daycard-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .dc-h2 {
          font-size: 1.9rem;
          margin: 0.25rem 0 0;
        }
        .stamp {
          font-size: 0.75rem;
          color: var(--cobalt);
          border: 1.5px solid var(--cobalt);
          border-radius: 999px;
          padding: 0.3rem 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
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
          cursor: pointer;
          color: var(--ink);
          transition: all 0.1s ease;
        }
        .check:hover {
          border-color: var(--ink-soft);
        }
        .check.on {
          border-color: var(--cobalt);
          background: color-mix(in srgb, var(--cobalt) 8%, var(--paper));
        }
        .box {
          flex: none;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: 2px solid var(--muted);
          display: grid;
          place-items: center;
          font-size: 0.85rem;
          color: var(--paper);
          margin-top: 1px;
        }
        .check.on .box {
          background: var(--cobalt);
          border-color: var(--cobalt);
        }
        .check-body {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .check-name {
          font-weight: 600;
          font-size: 0.98rem;
        }
        .opt {
          font-style: normal;
          font-size: 0.65rem;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .check-desc {
          font-size: 0.82rem;
          color: var(--muted);
          line-height: 1.4;
        }
        .field-block {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .field-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .field-label {
          font-size: 0.7rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .count {
          font-size: 0.7rem;
          color: var(--muted);
        }
        .count.flash {
          color: var(--cobalt);
        }
        .log-input {
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
        .log-input:focus {
          outline: none;
          border-color: var(--cobalt);
        }
      `}</style>
    </div>
  )
}
