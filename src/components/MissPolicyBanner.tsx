'use client'

import { Banner } from './AppProvider'

interface Props {
  banner: Banner
  whyNote: string
  onConfirmReset: () => void
  onDismiss: () => void
}

export function MissPolicyBanner({
  banner,
  whyNote,
  onConfirmReset,
  onDismiss,
}: Props) {
  const isReset = banner.kind === 'reset'
  return (
    <div className={`banner panel kind-${banner.kind}`} role="alert">
      <div className="banner-body">
        <span className="eyebrow">
          {isReset ? 'A day was missed' : banner.kind === 'skip' ? 'Skip token used' : banner.kind === 'extend' ? 'Challenge extended' : 'Note'}
        </span>
        <p className="msg">{banner.message}</p>
        {isReset && whyNote && (
          <blockquote className="why">
            <span className="why-label font-mono">Why you started</span>
            {whyNote}
          </blockquote>
        )}
      </div>
      <div className="banner-actions">
        {isReset ? (
          <button className="btn" onClick={onConfirmReset}>
            Restart at Day 1
          </button>
        ) : (
          <button className="btn btn-ghost small" onClick={onDismiss}>
            Got it
          </button>
        )}
      </div>

      <style jsx>{`
        .banner {
          display: flex;
          gap: 1.25rem;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          flex-wrap: wrap;
        }
        .kind-reset {
          border-color: var(--coral);
          box-shadow: 4px 5px 0 var(--coral);
        }
        .kind-skip {
          border-color: var(--marigold);
        }
        .kind-extend {
          border-color: var(--cobalt);
        }
        .banner-body {
          flex: 1;
          min-width: 240px;
        }
        .msg {
          margin: 0.35rem 0 0;
          font-size: 1.02rem;
          line-height: 1.45;
        }
        .why {
          margin: 0.9rem 0 0;
          padding: 0.75rem 1rem;
          border-left: 3px solid var(--coral);
          background: color-mix(in srgb, var(--coral) 7%, transparent);
          border-radius: 0 8px 8px 0;
          font-style: italic;
          color: var(--ink-soft);
        }
        .why-label {
          display: block;
          font-style: normal;
          font-size: 0.62rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 0.3rem;
        }
        .small {
          padding: 0.5rem 0.9rem;
          font-size: 0.7rem;
        }
      `}</style>
    </div>
  )
}
