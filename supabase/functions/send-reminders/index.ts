// Email reminder sender (Supabase Edge Function, Deno runtime).
//
// Schedule it every 15 minutes (Dashboard → Edge Functions → Schedules, or
// pg_cron + pg_net). Each run emails users whose local reminder time falls in
// the just-elapsed 15-minute window. Requires RESEND_API_KEY (resend.com) and
// REMINDER_FROM (verified sender) as function secrets.

import { createClient } from 'npm:@supabase/supabase-js@2'

const WINDOW_MIN = 15

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

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('REMINDER_FROM') ?? '75 Create <reminders@example.com>'
  if (!resendKey) {
    return new Response('RESEND_API_KEY is not configured', { status: 500 })
  }

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, tz, reminder_time')
    .not('reminder_time', 'is', null)
  if (error) return new Response(error.message, { status: 500 })

  const now = new Date()
  let sent = 0
  for (const p of profiles ?? []) {
    const [h, m] = String(p.reminder_time).split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) continue
    const target = h * 60 + m
    const local = localMinutes(p.tz || 'UTC', now)
    const delta = local - target
    if (delta < 0 || delta >= WINDOW_MIN) continue

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: p.email,
        subject: 'Make your mark — 75 Create',
        text:
          'This is your daily 75 Create reminder.\n\n' +
          'Check in, do your tasks, and stamp the grid before the day rolls over. ' +
          'If you already made your mark today, ignore this and be proud.\n',
      }),
    })
    if (res.ok) sent++
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
