'use client'

import { MAX_RULES, MIN_RULES, Rule } from '@/lib/types'
import { newId } from '@/lib/repository'
import { Icon } from './Icon'

interface Props {
  rules: Rule[]
  onChange: (rules: Rule[]) => void
}

export function RuleEditor({ rules, onChange }: Props) {
  function update(id: string, patch: Partial<Rule>) {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  function remove(id: string) {
    if (rules.length <= MIN_RULES) return
    const at = rules.findIndex((r) => r.id === id)
    const rest = rules.filter((r) => r.id !== id)
    onChange(rest)
    // The button that had focus is gone: land on the rule that took its
    // place (or the one before it), so keyboard users stay in the list.
    const next = rest[Math.min(at, rest.length - 1)]
    requestAnimationFrame(() => document.getElementById(`rule-name-${next.id}`)?.focus())
  }
  function add() {
    if (rules.length >= MAX_RULES) return
    onChange([
      ...rules,
      { id: newId(), name: 'New task', description: '', required: true },
    ])
  }

  return (
    <div className="editor">
      {rules.map((r, i) => (
        <div key={r.id} className="rule-edit panel">
          <div className="rule-top">
            <span className="idx font-mono">{String(i + 1).padStart(2, '0')}</span>
            <input
              id={`rule-name-${r.id}`}
              className="name-input font-display"
              value={r.name}
              onChange={(e) => update(r.id, { name: e.target.value })}
              aria-label={`Task ${i + 1} name`}
              aria-invalid={r.name.trim() === ''}
              aria-describedby={r.name.trim() === '' ? 'rules-problem' : undefined}
            />
            <button
              type="button"
              className="remove"
              onClick={() => remove(r.id)}
              disabled={rules.length <= MIN_RULES}
              aria-label={`Remove task ${i + 1}`}
              title={
                rules.length <= MIN_RULES
                  ? `Keep at least ${MIN_RULES} tasks`
                  : 'Remove task'
              }
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          {r.evidence && (
            <p className="evidence-note">
              {r.evidence === 'log'
                ? 'Met by writing the day’s log.'
                : 'Met by adding an image or a link.'}
            </p>
          )}
          <textarea
            className="field-input desc-input"
            value={r.description}
            onChange={(e) => update(r.id, { description: e.target.value })}
            placeholder="Describe what counts…"
            rows={2}
            aria-label={`Task ${i + 1} description`}
          />
          <label className="req-toggle font-mono">
            <input
              type="checkbox"
              checked={r.required}
              onChange={(e) => update(r.id, { required: e.target.checked })}
              aria-label={`Task ${i + 1} (${r.name.trim() || 'unnamed'}) is required to complete the day`}
            />
            Required to complete the day
          </label>
        </div>
      ))}

      <button
        type="button"
        className="btn btn-ghost add"
        onClick={add}
        disabled={rules.length >= MAX_RULES}
      >
        + Add task ({rules.length}/{MAX_RULES})
      </button>

      <style jsx>{`
        .editor {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .rule-edit {
          padding: 1rem 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }
        .rule-top {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .idx {
          color: var(--muted);
          font-size: 0.875rem;
        }
        .name-input {
          flex: 1;
          /* Without this the input's intrinsic width pushes the remove
             button off a 320px screen. */
          min-width: 0;
          min-height: 44px;
          font-size: 1.25rem;
          background: transparent;
          border: none;
          border-bottom: 1.5px dashed var(--field-border);
          color: var(--ink);
          padding: 0.15rem 0;
        }
        .name-input:focus {
          border-bottom-color: var(--cobalt);
        }
        .remove {
          flex: none;
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: transparent;
          border: none;
          color: var(--ink-soft);
          cursor: pointer;
        }
        .remove:hover:not(:disabled) {
          color: var(--coral-ink);
          background: var(--paper);
        }
        .remove:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .desc-input {
          /* Stays at the field's 16px so iOS doesn't zoom; quieter by colour. */
          color: var(--ink-soft);
        }
        .evidence-note {
          margin: 0;
          font-size: 0.875rem;
          color: var(--ink-soft);
        }
        .req-toggle {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          min-height: 44px;
          cursor: pointer;
          font-size: 0.8rem;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .add {
          align-self: flex-start;
        }
      `}</style>
    </div>
  )
}
