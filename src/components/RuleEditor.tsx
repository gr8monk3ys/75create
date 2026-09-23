'use client'

import { MAX_RULES, MIN_RULES, Rule } from '@/lib/types'
import { newId } from '@/lib/repository'
import { Icon } from './Icon'

interface Props {
  rules: Rule[]
  onChange: (rules: Rule[]) => void
}

/** The id of a rule's name field, for focusing it from outside. */
export function ruleNameId(rule: Rule): string {
  return `rule-name-${rule.id}`
}

/** The id of a rule's "required" checkbox, for focusing it from outside. */
export function ruleRequiredId(rule: Rule): string {
  return `rule-required-${rule.id}`
}

/**
 * Grows a field to its content, so a rule is read in full before it locks
 * (CSS field-sizing does this where supported; this covers the rest).
 */
function fit(el: HTMLTextAreaElement | null) {
  if (!el || CSS.supports?.('field-sizing', 'content')) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
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
    requestAnimationFrame(() => document.getElementById(ruleNameId(next))?.focus())
  }
  function add() {
    if (rules.length >= MAX_RULES) return
    const rule = { id: newId(), name: 'New rule', description: '', required: true }
    onChange([...rules, rule])
    // Straight into naming it: the placeholder name is selected, so typing
    // replaces it.
    requestAnimationFrame(() => {
      const input = document.getElementById(ruleNameId(rule)) as HTMLTextAreaElement | null
      input?.focus()
      input?.select()
    })
  }

  return (
    <div className="editor">
      {rules.map((r, i) => (
        <div key={r.id} className="rule-edit panel">
          <div className="rule-top">
            <span className="idx font-mono">{String(i + 1).padStart(2, '0')}</span>
            {/* A one-line field that wraps: a long name is read whole. */}
            <textarea
              id={ruleNameId(r)}
              ref={fit}
              rows={1}
              className="name-input font-display"
              value={r.name}
              onChange={(e) => {
                update(r.id, { name: e.target.value.replace(/\s*\n\s*/g, ' ') })
                fit(e.currentTarget)
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              aria-label={`Rule ${i + 1} name`}
              aria-invalid={r.name.trim() === ''}
              aria-describedby={r.name.trim() === '' ? `rule-error-${r.id}` : undefined}
            />
            <button
              type="button"
              className="remove"
              onClick={() => remove(r.id)}
              disabled={rules.length <= MIN_RULES}
              aria-label={`Remove rule ${i + 1}`}
              title={
                rules.length <= MIN_RULES
                  ? `Keep at least ${MIN_RULES} rules`
                  : 'Remove rule'
              }
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          {r.name.trim() === '' && (
            <p className="rule-error" id={`rule-error-${r.id}`}>
              This rule needs a name.
            </p>
          )}
          {r.evidence && (
            <p className="evidence-note">
              {r.evidence === 'log'
                ? 'Met by writing the day’s log.'
                : 'Met by adding an image or a link.'}
            </p>
          )}
          <textarea
            ref={fit}
            className="field-input desc-input"
            value={r.description}
            onChange={(e) => {
              update(r.id, { description: e.target.value })
              fit(e.currentTarget)
            }}
            placeholder="Describe what counts…"
            rows={2}
            aria-label={`Rule ${i + 1} description`}
          />
          <label className="req-toggle font-mono">
            <input
              id={ruleRequiredId(r)}
              type="checkbox"
              checked={r.required}
              onChange={(e) => update(r.id, { required: e.target.checked })}
              aria-label={`Rule ${i + 1} (${r.name.trim() || 'unnamed'}) is required to complete the day`}
            />
            Required to complete the day
          </label>
        </div>
      ))}

      <button
        type="button"
        className="btn btn-ghost add"
        onClick={add}
        // Stays focusable when the seventh task fills the list.
        aria-disabled={rules.length >= MAX_RULES}
      >
        <Icon name="plus" size={16} />
        Add rule ({rules.length}/{MAX_RULES})
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
          padding: 0.3rem 0 0.15rem;
          line-height: 1.25;
          resize: none;
          overflow: hidden;
          field-sizing: content;
        }
        .name-input:focus {
          border-bottom-color: var(--cobalt);
        }
        /* A nameless rule says so where it is, not only in the form's hint. */
        .name-input[aria-invalid='true'] {
          border-bottom: 1.5px solid var(--coral-ink);
        }
        .rule-error {
          margin: 0;
          font-size: 0.875rem;
          color: var(--coral-ink);
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
          /* Grows with the text: nothing is locked in half-read. */
          resize: none;
          overflow: hidden;
          field-sizing: content;
          min-height: 3.2em;
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
        /* Without field-sizing the height is set from script; if the width
           changes after that (rotation, a late font), scroll, never clip. */
        @supports not (field-sizing: content) {
          .name-input,
          .desc-input {
            overflow-y: auto;
          }
        }
      `}</style>
    </div>
  )
}
