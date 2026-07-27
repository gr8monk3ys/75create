'use client'

import { useEffect } from 'react'
import { useApp } from './AppProvider'

// Fires the opt-in daily browser notification at the user's reminder time,
// once per day, while the app (or installed PWA) is open. Skips days that are
// already complete.

const LAST_FIRED_KEY = '75create.reminder.lastFired'
const CHECK_MS = 30_000

function localParts(tz: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return {
    date: `${g('year')}-${g('month')}-${g('day')}`,
    time: `${g('hour')}:${g('minute')}`,
  }
}

export function ReminderScheduler() {
  const { user, challenge, derived } = useApp()

  useEffect(() => {
    if (!user?.reminderTime || !challenge) return
    if (typeof Notification === 'undefined') return
    const reminderTime = user.reminderTime

    const tick = () => {
      if (Notification.permission !== 'granted') return
      const { date, time } = localParts(user.tz)
      if (time < reminderTime) return
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
  }, [user, challenge, derived])

  return null
}
