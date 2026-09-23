'use client'

import { useEffect } from 'react'
import { useApp } from './AppProvider'
import { localDate, localTime } from '@/lib/creativeDay'

// Fires the opt-in daily browser notification at the user's reminder time,
// once per day, while the app (or installed PWA) is open. Skips days that are
// already complete.

// Under the app's `75create.` prefix, so account deletion clears it too.
const LAST_FIRED_KEY = '75create.reminder.lastFired'
const CHECK_MS = 30_000

export function ReminderScheduler() {
  const { user, challenge, derived, phase } = useApp()

  useEffect(() => {
    if (!user?.reminderTime || !challenge || phase !== 'active') return
    if (typeof Notification === 'undefined') return
    const reminderTime = user.reminderTime

    const tick = () => {
      if (Notification.permission !== 'granted') return
      const now = new Date()
      const date = localDate(now, user.tz)
      if (localTime(now, user.tz) < reminderTime) return
      if (localStorage.getItem(LAST_FIRED_KEY) === date) return
      const today = derived.days.find((d) => d.index === derived.currentIndex)
      if (!today || today.state === 'complete') return
      localStorage.setItem(LAST_FIRED_KEY, date)
      new Notification('75 Create', {
        body: `Day ${derived.currentIndex}: make your mark before the day rolls over.`,
        icon: '/icon-192.png',
      })
    }

    tick()
    const id = setInterval(tick, CHECK_MS)
    return () => clearInterval(id)
  }, [user, challenge, derived, phase])

  return null
}
