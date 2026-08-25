'use client'

// Route-level error boundary. A render error used to leave a blank page with no
// way out — and the user's challenge sitting untouched in localStorage behind
// it. This says what happened, offers a retry, and points at the export.

import { useEffect } from 'react'
import Link from 'next/link'
import { reportError } from '@/lib/reportError'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportError(error, { boundary: 'route' })
  }, [error])

  return (
    <main className="err">
      <span className="eyebrow">Something broke</span>
      <h1 className="font-display err-h1">That didn’t load.</h1>
      <p className="err-body">
        Your challenge is safe — every day you’ve logged is stored on this device
        and nothing here touched it. Try again, and if this keeps happening you can
        still export your data from settings.
      </p>
      <div className="err-actions">
        <button className="btn" onClick={reset}>
          Try again
        </button>
        <Link href="/dashboard" className="btn btn-ghost">
          Back to the grid
        </Link>
      </div>
      {error.digest && (
        <p className="err-digest font-mono">Reference: {error.digest}</p>
      )}

      <style jsx>{`
        .err {
          max-width: 34rem;
          min-height: 80dvh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.75rem;
          padding: 2rem 1.5rem;
        }
        .err-h1 {
          font-size: clamp(2rem, 7vw, 2.8rem);
          margin: 0.25rem 0 0.5rem;
        }
        .err-body {
          color: var(--ink-soft);
          line-height: 1.6;
          margin: 0;
        }
        .err-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 1.25rem;
        }
        .err-digest {
          color: var(--muted);
          font-size: 0.72rem;
          margin-top: 1.5rem;
        }
      `}</style>
    </main>
  )
}
