'use client'

import { useEffect, useState } from 'react'
import { useApp } from './AppProvider'
import { localTime } from '@/lib/creativeDay'
import { getPushStatus } from '@/lib/push'

// Fires the opt-in daily browser notification at the user's reminder time,
// once per creative day, while the app (or installed PWA) is open. Only when
// today is still to make, and never on a device that gets the server's push
// reminder (that one arrives with the app closed, too; two would be nagging).

// Under the app's `75create.` prefix, so account deletion clears it too.
const LAST_FIRED_KEY = '75create.reminder.lastFired'
const CHECK_MS = 30_000

/** Minutes since the creative day began (midnight plus the buffer). */
function intoCreativeDay(hhmm: string, bufferHrs: number): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (((h * 60 + m - bufferHrs * 60) % 1440) + 1440) % 1440
}

export function ReminderScheduler() {
  const { user, derived, phase, creativeToday, supabaseEnabled } = useApp()
  // Unknown until checked: no in-page reminder fires before we know the
  // server isn't already sending one to this device.
  const [pushChecked, setPushChecked] = useState(!supabaseEnabled)
  const [pushed, setPushed] = useState(false)

  useEffect(() => {
    if (!supabaseEnabled) return
    let cancelled = false
    void getPushStatus().then((s) => {
      if (cancelled) return
      setPushed(s === 'subscribed')
      setPushChecked(true)
    })
    return () => {
      cancelled = true
    }
  }, [supabaseEnabled])

  const reminderTime = user?.reminderTime ?? null
  const tz = user?.tz ?? 'UTC'
  const bufferHrs = user?.lateNightBufferHrs ?? 0
  const today = derived.days.find((d) => d.index === derived.currentIndex)
  const todayOpen = phase === 'active' && today !== undefined && today.state !== 'complete'
  const dayIndex = derived.currentIndex

  useEffect(() => {
    if (!reminderTime || !todayOpen || !pushChecked || pushed) return
    if (typeof Notification === 'undefined') return

    const tick = () => {
      if (Notification.permission !== 'granted') return
      // Compared within the creative day, so a reminder inside the late-night
      // buffer (1am with a 3am cut-off) belongs to the day it closes, and
      // doesn't fire again when the next one begins.
      const now = intoCreativeDay(localTime(new Date(), tz), bufferHrs)
      if (now < intoCreativeDay(reminderTime, bufferHrs)) return
      if (localStorage.getItem(LAST_FIRED_KEY) === creativeToday) return
      localStorage.setItem(LAST_FIRED_KEY, creativeToday)
      new Notification('75 Create', {
        body: `Day ${dayIndex}: make your mark before the day rolls over.`,
        icon: '/icon-192.png',
        // One per day: a repeat replaces rather than stacks.
        tag: `75create-${creativeToday}`,
      })
    }

    tick()
    const id = setInterval(tick, CHECK_MS)
    return () => clearInterval(id)
  }, [reminderTime, tz, bufferHrs, todayOpen, pushChecked, pushed, creativeToday, dayIndex])

  return null
}
