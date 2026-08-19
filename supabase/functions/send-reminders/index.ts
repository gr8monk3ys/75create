// Email reminder sender (Supabase Edge Function, Deno runtime).
//
// Schedule it every 15 minutes (Dashboard → Edge Functions → Schedules, or
// pg_cron + pg_net). Each run emails users whose local reminder time falls in
// the just-elapsed 15-minute window.
//
// Secrets:
//   RESEND_API_KEY   required — resend.com API key
//   REMINDER_FROM    required in production — a verified sender
//   REMINDER_SECRET  required — shared secret; callers must send it as
//                    `x-reminder-secret`. Without this the function URL is an
//                    open email-sending endpoint billed to your account.

import { createClient } from 'npm:@supabase/supabase-js@2'

const WINDOW_MIN = 15
/** PostgREST caps a response at 1000 rows, so profiles are read in pages. */
const PAGE_SIZE = 500
/** Resend is rate-limited; send in small concurrent batches, not all at once. */
const BATCH_SIZE = 10

interface Profile {
  id: string
  email: string
  tz: string | null
  reminder_time: string | null
}

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

/** Whether this profile's local reminder time falls in the elapsed window. */
function isDue(profile: Profile, now: Date): boolean {
  const [h, m] = String(profile.reminder_time).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return false
  let tz = profile.tz || 'UTC'
  let local: number
  try {
    local = localMinutes(tz, now)
  } catch {
    // An invalid IANA zone would throw and abort the whole run.
    tz = 'UTC'
    local = localMinutes(tz, now)
  }
  const delta = local - (h * 60 + m)
  return delta >= 0 && delta < WINDOW_MIN
}

/** Constant-time-ish comparison, so the secret can't be probed byte by byte. */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided || provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

async function sendReminder(
  profile: Profile,
  resendKey: string,
  from: string,
): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: profile.email,
      subject: 'Make your mark — 75 Create',
      text:
        'This is your daily 75 Create reminder.\n\n' +
        'Check in, do your tasks, and stamp the grid before the day rolls over. ' +
        'If you already made your mark today, ignore this and be proud.\n',
    }),
  })
  return res.ok
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('REMINDER_SECRET')
  if (!secret) {
    return new Response('REMINDER_SECRET is not configured', { status: 500 })
  }
  if (!secretMatches(req.headers.get('x-reminder-secret'), secret)) {
    return new Response('Forbidden', { status: 403 })
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    return new Response('RESEND_API_KEY is not configured', { status: 500 })
  }
  const from = Deno.env.get('REMINDER_FROM') ?? '75 Create <reminders@example.com>'

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const now = new Date()
  let sent = 0
  let failed = 0
  let scanned = 0

  for (let page = 0; ; page++) {
    const from_ = page * PAGE_SIZE
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, tz, reminder_time')
      .not('reminder_time', 'is', null)
      .order('id', { ascending: true })
      .range(from_, from_ + PAGE_SIZE - 1)

    if (error) return new Response(error.message, { status: 500 })
    const profiles = (data ?? []) as Profile[]
    if (profiles.length === 0) break
    scanned += profiles.length

    const due = profiles.filter((p) => isDue(p, now))
    for (let i = 0; i < due.length; i += BATCH_SIZE) {
      const results = await Promise.all(
        due
          .slice(i, i + BATCH_SIZE)
          .map((p) =>
            sendReminder(p, resendKey, from).catch(() => false),
          ),
      )
      for (const ok of results) ok ? sent++ : failed++
    }

    if (profiles.length < PAGE_SIZE) break
  }

  return new Response(JSON.stringify({ scanned, sent, failed }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
