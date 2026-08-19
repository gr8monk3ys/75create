// Single funnel for unhandled errors.
//
// There is no error-reporting vendor wired up yet, and adding one is a
// deployment decision rather than a code one. What this does give you is one
// place to add it: set NEXT_PUBLIC_ERROR_ENDPOINT and every boundary, rejection
// and window error posts a small JSON body to it. Without the env var it logs
// to the console and nothing leaves the device.

interface ErrorContext {
  boundary?: 'route' | 'global' | 'window' | 'unhandledrejection'
  [key: string]: unknown
}

const endpoint = process.env.NEXT_PUBLIC_ERROR_ENDPOINT

export function reportError(error: unknown, context: ErrorContext = {}): void {
  const err = error instanceof Error ? error : new Error(String(error))

  // Always visible in devtools, whether or not a sink is configured.
  console.error('[75create]', err, context)

  if (!endpoint || typeof fetch === 'undefined') return

  const body = JSON.stringify({
    message: err.message,
    stack: err.stack,
    digest: (err as { digest?: string }).digest,
    context,
    url: typeof location === 'undefined' ? null : location.pathname,
    userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    at: new Date().toISOString(),
  })

  // keepalive so a report survives the navigation that often follows a crash.
  // Reporting must never itself throw, so failures are swallowed.
  try {
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignore
  }
}

/** Catch what never reaches a React boundary: async throws and rejections. */
export function installGlobalErrorHandlers(): () => void {
  if (typeof window === 'undefined') return () => {}

  const onError = (e: ErrorEvent) =>
    reportError(e.error ?? e.message, { boundary: 'window' })
  const onRejection = (e: PromiseRejectionEvent) =>
    reportError(e.reason, { boundary: 'unhandledrejection' })

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
