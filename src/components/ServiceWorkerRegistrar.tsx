'use client'

import { useEffect } from 'react'
import { installGlobalErrorHandlers } from '@/lib/reportError'

export default function ServiceWorkerRegistrar() {
  useEffect(() => installGlobalErrorHandlers(), [])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is progressive enhancement; the app works without it.
    })
    // The first visit fetched its CSS, fonts and chunks before the worker
    // was there to see them: hand it the list, so the app works offline
    // from the first visit, not the second.
    void navigator.serviceWorker.ready.then((reg) => {
      const urls = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((u) => u.startsWith(`${location.origin}/_next/static/`))
      if (urls.length) reg.active?.postMessage({ type: 'cache-static', urls })
    })
  }, [])
  return null
}
