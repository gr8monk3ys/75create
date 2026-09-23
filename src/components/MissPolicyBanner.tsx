'use client'

import { Banner } from './AppProvider'

interface Props {
  banner: Banner
  whyNote: string
  onConfirmReset: () => void
  onDismiss: () => void
}

const TITLES: Record<Banner['kind'], [one: string, many: string]> = {
  reset: ['This attempt has ended.', 'This attempt has ended.'],
  skip: ['A skip token covered you.', 'Skip tokens covered you.'],
  extend: ['The challenge got longer.', 'The challenge got longer.'],
  restore: ['A made day came back.', 'Made days came back.'],
}

/**
 * The consequence of a missed day, stated plainly, with the person's own
 * reason for starting shown back to them. A reset can only be confirmed, not
 * dismissed: there is no attempt left to continue.
 */
export function MissPolicyBanner({ banner, whyNote, onConfirmReset, onDismiss }: Props) {
  const isReset = banner.kind === 'reset'
  return (
    <section
      className={`banner panel kind-${banner.kind}`}
      role={isReset ? 'alert' : 'status'}
      aria-labelledby="banner-title"
    >
      <div className="banner-body">
        <h2 id="banner-title" className="font-display title">
          {TITLES[banner.kind][(banner.count ?? 1) > 1 ? 1 : 0]}
        </h2>
        <p className="msg">{banner.message}</p>
        {/* Their reason for starting belongs with a miss, not with good news. */}
        {whyNote && banner.kind !== 'restore' && (
          <figure className="why">
            <blockquote>{whyNote}</blockquote>
            <figcaption>
              <span aria-hidden>— </span>Why you started
            </figcaption>
          </figure>
        )}
      </div>
      <div className="banner-actions">
        {isReset ? (
          <button className="btn" onClick={onConfirmReset}>
            Start again at Day 1
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={onDismiss}>
            Got it
          </button>
        )}
      </div>

      <style jsx>{`
        .banner {
          display: flex;
          gap: 1.25rem;
          align-items: flex-end;
          justify-content: space-between;
          padding: 1.4rem 1.5rem;
          flex-wrap: wrap;
        }
        .kind-reset {
          border-color: var(--coral);
          box-shadow: 4px 5px 0 var(--coral);
        }
        .kind-skip {
          border-color: var(--marigold);
        }
        .kind-restore {
          /* Cobalt: this is about a day that was made. */
          border-color: var(--cobalt);
        }
        .kind-extend {
          /* A miss, not a made day: never cobalt. */
          border-color: var(--ink-soft);
        }
        .banner-body {
          flex: 1;
          min-width: min(100%, 260px);
        }
        .title {
          font-size: 1.25rem;
          margin: 0;
        }
        .msg {
          margin: 0.45rem 0 0;
          font-size: 1rem;
          line-height: 1.5;
          max-width: 60ch;
        }
        .why {
          margin: 1rem 0 0;
          padding: 0.9rem 1.1rem;
          background: var(--paper);
          border-radius: 10px;
          max-width: 60ch;
        }
        .why blockquote {
          margin: 0;
          /* Lead: their own words, in the reading face. */
          font-family: var(--font-body);
          font-size: 1.125rem;
          line-height: 1.5;
          color: var(--ink);
          quotes: '“' '”';
        }
        .why blockquote::before {
          content: open-quote;
        }
        .why blockquote::after {
          content: close-quote;
        }
        .why figcaption {
          margin-top: 0.45rem;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--muted);
        }
      `}</style>
    </section>
  )
}
