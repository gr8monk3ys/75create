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
  }, [])
  return null
}
