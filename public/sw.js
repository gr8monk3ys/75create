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

// cache.addAll() rejects atomically, so a single 404 in the list used to mean
// the worker never installed at all and offline support silently didn't exist.
// Each URL is cached independently; whatever succeeds is worth having.
async function precache() {
  const cache = await caches.open(CACHE)
  const results = await Promise.allSettled(
    PRECACHE.map(async (url) => {
      const response = await fetch(url, { cache: 'reload' })
      if (!response.ok) throw new Error(`${url}: ${response.status}`)
      await cache.put(url, response)
    })
  )
  const failed = results.filter((r) => r.status === 'rejected')
  if (failed.length) {
    console.warn(`[75create sw] ${failed.length}/${PRECACHE.length} precache misses`)
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

// Lets the page trigger an immediate activation after it sees a new worker.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
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

/* ---- Web Push ----------------------------------------------------------
 * Reminders arrive through the browser's push service, so they work with the
 * app closed — and on iOS, where the Notification constructor doesn't exist,
 * this is the only way a reminder reaches the user at all.
 *
 * Pushes are sent without a payload: the message is fixed, and going
 * payload-less means the sender needs no message encryption. showNotification
 * is mandatory — a push that displays nothing costs the site its permission.
 */
self.addEventListener('push', (event) => {
  let body = 'Make your mark before the day rolls over.'
  if (event.data) {
    try {
      body = event.data.json().body ?? body
    } catch {
      body = event.data.text() || body
    }
  }

  event.waitUntil(
    self.registration.showNotification('75 Create', {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: '75create-reminder',
      renotify: true,
      data: { url: '/dashboard' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/dashboard'

  // Focus an open tab if there is one rather than piling up new ones.
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (new URL(client.url).pathname === target && 'focus' in client) {
            return client.focus()
          }
        }
        return self.clients.openWindow(target)
      })
  )
})
