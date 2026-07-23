'use client'

import { MAX_RULES, MIN_RULES, Rule } from '@/lib/types'
import { newId } from '@/lib/repository'

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
    onChange(rules.filter((r) => r.id !== id))
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
              className="name-input font-display"
              value={r.name}
              onChange={(e) => update(r.id, { name: e.target.value })}
              aria-label={`Task ${i + 1} name`}
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
              ✕
            </button>
          </div>
          <textarea
            className="desc-input"
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
          color: var(--coral);
          font-size: 0.85rem;
        }
        .name-input {
          flex: 1;
          font-size: 1.15rem;
          background: transparent;
          border: none;
          border-bottom: 1.5px solid transparent;
          color: var(--ink);
          padding: 0.15rem 0;
        }
        .name-input:focus {
          outline: none;
          border-bottom-color: var(--cobalt);
        }
        .remove {
          background: transparent;
          border: none;
          color: var(--muted);
          cursor: pointer;
          font-size: 0.9rem;
          padding: 0.25rem;
        }
        .remove:hover:not(:disabled) {
          color: var(--coral);
        }
        .remove:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .desc-input {
          font-family: var(--font-body);
          font-size: 0.9rem;
          background: var(--paper);
          border: 1.5px solid var(--line);
          border-radius: 8px;
          padding: 0.6rem 0.75rem;
          color: var(--ink-soft);
          resize: vertical;
        }
        .desc-input:focus {
          outline: none;
          border-color: var(--cobalt);
        }
        .req-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.72rem;
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
