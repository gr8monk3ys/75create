'use client'

// Last-resort boundary: catches errors thrown in the root layout itself, where
// `error.tsx` never mounts. It replaces <html>, so it carries its own styles and
// cannot rely on globals.css having loaded. The palette is repeated here, both
// themes, as literal values for that reason.

import { useEffect } from 'react'
import { reportError } from '@/lib/reportError'

const CSS = `
  .ge { --paper: #efe9dc; --ink: #1b1a17; --soft: #4a463d; color-scheme: light;
    margin: 0; min-height: 100dvh; display: flex; flex-direction: column;
    justify-content: center; padding: 2rem 1.5rem; background: var(--paper);
    color: var(--ink); font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.6; }
  @media (prefers-color-scheme: dark) {
    .ge { --paper: #15140f; --ink: #f3ecdd; --soft: #cdc5b4; color-scheme: dark; }
  }
  .ge-box { max-width: 34rem; margin: 0 auto; }
  .ge h1 { font-size: 2rem; margin: 0.5rem 0 0.75rem; line-height: 1.05; }
  .ge p { margin: 0; color: var(--soft); }
  .ge button { margin-top: 1.5rem; min-height: 44px; padding: 0.85rem 1.4rem;
    border-radius: 999px; border: 1.5px solid var(--ink); background: var(--ink);
    color: var(--paper); font-family: ui-monospace, monospace; font-size: 0.875rem;
    letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; }
  .ge button:focus-visible { outline: 3px solid #6f85ff; outline-offset: 2px; }
`

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
      <head>
        <title>Something went wrong · 75 Create</title>
        <style>{CSS}</style>
      </head>
      <body className="ge">
        <main className="ge-box">
          <h1>75 Create couldn’t start.</h1>
          <p>
            Nothing you’ve logged was touched — it’s still stored on this device. Reload to
            try again.
          </p>
          <button onClick={reset}>Reload</button>
        </main>
      </body>
    </html>
  )
}
