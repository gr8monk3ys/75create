'use client'

import { useEffect } from 'react'
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

export function ReminderScheduler() {
  const { user, challenge, derived, phase, creativeToday, supabaseEnabled } = useApp()

  useEffect(() => {
    if (!user?.reminderTime || !challenge || phase !== 'active') return
    if (typeof Notification === 'undefined') return
    const reminderTime = user.reminderTime
    let pushed = false
    if (supabaseEnabled) void getPushStatus().then((s) => (pushed = s === 'subscribed'))

    const tick = () => {
      if (pushed || Notification.permission !== 'granted') return
      if (localTime(new Date(), user.tz) < reminderTime) return
      if (localStorage.getItem(LAST_FIRED_KEY) === creativeToday) return
      const today = derived.days.find((d) => d.index === derived.currentIndex)
      if (!today || today.state === 'complete') return
      localStorage.setItem(LAST_FIRED_KEY, creativeToday)
      new Notification('75 Create', {
        body: `Day ${derived.currentIndex}: make your mark before the day rolls over.`,
        icon: '/icon-192.png',
      })
    }

    tick()
    const id = setInterval(tick, CHECK_MS)
    return () => clearInterval(id)
  }, [user, challenge, derived, phase, creativeToday, supabaseEnabled])

  return null
}
