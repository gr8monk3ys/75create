'use client'

// Last-resort boundary: catches errors thrown in the root layout itself, where
// `error.tsx` never mounts. It replaces <html>, so it carries its own styles and
// cannot rely on globals.css having loaded.

import { useEffect } from 'react'
import { reportError } from '@/lib/reportError'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportError(error, { boundary: 'global' })
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '0.9rem',
          padding: '2rem 1.5rem',
          background: '#efe9dc',
          color: '#1b1a17',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          lineHeight: 1.6,
        }}
      >
        <div style={{ maxWidth: '34rem', margin: '0 auto' }}>
          <p
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.72rem',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: '#8a8274',
              margin: 0,
            }}
          >
            Something broke
          </p>
          <h1 style={{ fontSize: '2.2rem', margin: '0.5rem 0 0.75rem', lineHeight: 1.05 }}>
            75 Create couldn’t start.
          </h1>
          <p style={{ margin: 0, color: '#4a463d' }}>
            Nothing you’ve logged was touched — it’s still stored on this device.
            Reload to try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              padding: '0.85rem 1.4rem',
              borderRadius: 999,
              border: '1.5px solid #1b1a17',
              background: '#1b1a17',
              color: '#efe9dc',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.85rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
