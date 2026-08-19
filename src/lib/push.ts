// Web Push subscription management.
//
// The in-page reminder (ReminderScheduler) only fires while the app is open,
// and on iOS the Notification constructor doesn't exist at all — so on a phone
// it never fires. A push subscription is delivered by the browser's push
// service with the app closed, and works in an installed PWA on iOS 16.4+.
//
// Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY (the public half of the VAPID key pair
// whose private half the send-push function holds). Without it, push is simply
// unavailable and the app falls back to the in-page reminder.

import type { SupabaseClient } from '@supabase/supabase-js'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

export type PushStatus =
  | 'unsupported' // the browser can't do push, or no VAPID key is configured
  | 'denied' // the user refused notification permission
  | 'subscribed'
  | 'unsubscribed'

/** Decode the base64url VAPID key into the bytes pushManager expects. */
export function decodeVapidKey(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Base64url-encode an ArrayBuffer, for storing subscription keys. */
function encodeKey(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    Boolean(VAPID_PUBLIC_KEY)
  )
}

/** The current state, without prompting for anything. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const registration = await navigator.serviceWorker.getRegistration()
  const existing = await registration?.pushManager.getSubscription()
  return existing ? 'subscribed' : 'unsubscribed'
}

/**
 * Ask for permission if needed, subscribe, and record the subscription so the
 * server can reach this device. Returns the resulting status.
 */
export async function subscribeToPush(
  client: SupabaseClient,
  userId: string,
): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported'

  const permission =
    Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission
  if (permission !== 'granted') return 'denied'

  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      // Required by every browser: a push must be shown to the user.
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(VAPID_PUBLIC_KEY!) as BufferSource,
    }))

  const { error } = await client.from('push_subscriptions').upsert({
    endpoint: subscription.endpoint,
    user_id: userId,
    p256dh: encodeKey(subscription.getKey('p256dh')),
    auth: encodeKey(subscription.getKey('auth')),
    failed_at: null,
  })
  if (error) {
    // Don't leave a subscription the server doesn't know about: it would look
    // like reminders are on while nothing can ever deliver one.
    await subscription.unsubscribe()
    return 'unsubscribed'
  }
  return 'subscribed'
}

/** Drop this device's subscription, locally and on the server. */
export async function unsubscribeFromPush(client: SupabaseClient): Promise<void> {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  await client.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}
