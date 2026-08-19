// Web Push reminder sender (Supabase Edge Function, Deno runtime).
//
// Schedule it every 15 minutes alongside send-reminders. Each run pushes to the
// devices of users whose local reminder time falls in the just-elapsed window.
//
// Pushes are sent WITHOUT a payload. A payload would have to be encrypted per
// RFC 8291, and the message here is fixed anyway — the service worker supplies
// the text. That keeps this function to VAPID authentication (RFC 8292), which
// is a signed JWT and nothing more.
//
// Secrets:
//   VAPID_PUBLIC_KEY    base64url, uncompressed P-256 point (65 bytes)
//   VAPID_PRIVATE_KEY   base64url, raw P-256 private scalar (32 bytes)
//   VAPID_SUBJECT       mailto: or https: contact URL for your service
//   PUSH_SECRET         shared secret; callers send it as `x-push-secret`
//
// Generate a key pair with:
//   npx web-push generate-vapid-keys

import { createClient } from 'npm:@supabase/supabase-js@2'
import { importVapidKey, vapidToken } from '../_shared/vapid.ts'

const WINDOW_MIN = 15
const PAGE_SIZE = 500
const BATCH_SIZE = 20
/** How long the push service should hold the message if the device is offline. */
const TTL_SECONDS = 3 * 60 * 60

interface Subscriber {
  endpoint: string
  user_id: string
  tz: string | null
  reminder_time: string | null
}

// ---------- scheduling ----------

function localMinutes(tz: string, now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return g('hour') * 60 + g('minute')
}

function isDue(sub: Subscriber, now: Date): boolean {
  const [h, m] = String(sub.reminder_time).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return false
  let local: number
  try {
    local = localMinutes(sub.tz || 'UTC', now)
  } catch {
    local = localMinutes('UTC', now)
  }
  const delta = local - (h * 60 + m)
  return delta >= 0 && delta < WINDOW_MIN
}

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided || provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

// ---------- delivery ----------

type SendOutcome = 'sent' | 'gone' | 'failed'

async function sendPush(
  endpoint: string,
  subject: string,
  publicKey: string,
  key: CryptoKey,
): Promise<SendOutcome> {
  const audience = new URL(endpoint).origin
  const token = await vapidToken(audience, subject, key)

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${token}, k=${publicKey}`,
      TTL: String(TTL_SECONDS),
      Urgency: 'normal',
      // No body, so no Content-Encoding: the service worker supplies the text.
      'Content-Length': '0',
    },
  })

  // 404/410 mean the browser threw this subscription away — stop retrying it.
  if (res.status === 404 || res.status === 410) return 'gone'
  return res.ok ? 'sent' : 'failed'
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_SECRET')
  if (!secret) return new Response('PUSH_SECRET is not configured', { status: 500 })
  if (!secretMatches(req.headers.get('x-push-secret'), secret)) {
    return new Response('Forbidden', { status: 403 })
  }

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT')
  if (!publicKey || !privateKey || !subject) {
    return new Response('VAPID keys are not configured', { status: 500 })
  }

  let key: CryptoKey
  try {
    key = await importVapidKey(privateKey, publicKey)
  } catch (e) {
    return new Response(`Invalid VAPID key: ${(e as Error).message}`, { status: 500 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const now = new Date()
  let sent = 0
  let failed = 0
  let pruned = 0

  for (let page = 0; ; page++) {
    const start = page * PAGE_SIZE
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, user_id, profiles!inner(tz, reminder_time)')
      .is('failed_at', null)
      .not('profiles.reminder_time', 'is', null)
      .order('endpoint', { ascending: true })
      .range(start, start + PAGE_SIZE - 1)

    if (error) return new Response(error.message, { status: 500 })
    const rows = data ?? []
    if (rows.length === 0) break

    const subscribers: Subscriber[] = rows.map((row) => {
      const profile = (row as unknown as { profiles: { tz: string; reminder_time: string } })
        .profiles
      return {
        endpoint: (row as { endpoint: string }).endpoint,
        user_id: (row as { user_id: string }).user_id,
        tz: profile?.tz ?? null,
        reminder_time: profile?.reminder_time ?? null,
      }
    })

    const due = subscribers.filter((s) => isDue(s, now))
    for (let i = 0; i < due.length; i += BATCH_SIZE) {
      const batch = due.slice(i, i + BATCH_SIZE)
      const outcomes = await Promise.all(
        batch.map((s) =>
          sendPush(s.endpoint, subject, publicKey, key).catch(
            () => 'failed' as SendOutcome,
          ),
        ),
      )
      const gone: string[] = []
      outcomes.forEach((outcome, index) => {
        if (outcome === 'sent') sent++
        else if (outcome === 'failed') failed++
        else gone.push(batch[index].endpoint)
      })
      if (gone.length > 0) {
        pruned += gone.length
        await supabase.from('push_subscriptions').delete().in('endpoint', gone)
      }
    }

    if (rows.length < PAGE_SIZE) break
  }

  return new Response(JSON.stringify({ sent, failed, pruned }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
