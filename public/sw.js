/* 75 Create service worker: offline-capable app shell.
 *
 * Strategy:
 * - Navigations: network-first, falling back to the cached copy of the page,
 *   then to the cached landing page. Keeps deploys fresh while staying usable
 *   offline (all challenge state lives in localStorage/IndexedDB anyway).
 * - /_next/static/ (content-hashed, immutable): cache-first.
 * - Other same-origin GETs (icons, manifest): stale-while-revalidate.
 */

const VERSION = 'v1'
const CACHE = `75create-${VERSION}`

const PRECACHE = [
  '/',
  '/signin',
  '/setup',
  '/dashboard',
  '/dashboard/share',
  '/settings',
  '/recap',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE)
  try {
    const fresh = await fetch(request)
    if (fresh.ok) cache.put(request, fresh.clone())
    return fresh
  } catch {
    const cached = await cache.match(request)
    return cached || cache.match('/')
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const fresh = await fetch(request)
  if (fresh.ok) cache.put(request, fresh.clone())
  return fresh
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  const refresh = fetch(request)
    .then((fresh) => {
      if (fresh.ok) cache.put(request, fresh.clone())
      return fresh
    })
    .catch(() => cached)
  return cached || refresh
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request))
  } else {
    event.respondWith(staleWhileRevalidate(request))
  }
})
