// Which of a batch of due users still have today's day to make. Shared by the
// email and push senders so they can't disagree about whom to nudge.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { StoredChallenge, StoredDayData, todayNeedsMaking } from './schedule.ts'

export interface DueUser {
  id: string
  tz: string | null
  late_night_buffer_hrs: number | null
}

/** The ids of `users` with a running challenge whose today isn't made yet. */
export async function usersWithTodayOpen(
  supabase: SupabaseClient,
  users: DueUser[],
  now: Date,
): Promise<Set<string>> {
  const ids = [...new Set(users.map((u) => u.id))]
  if (ids.length === 0) return new Set()

  const [challenges, days] = await Promise.all([
    supabase.from('challenges').select('id, user_id, data').in('user_id', ids),
    supabase.from('day_data').select('challenge_id, user_id, data').in('user_id', ids),
  ])
  if (challenges.error) throw challenges.error
  if (days.error) throw days.error

  const byUser = new Map<string, StoredChallenge[]>()
  for (const row of challenges.data ?? []) {
    const list = byUser.get(row.user_id) ?? []
    list.push({ ...(row.data as StoredChallenge), id: row.id })
    byUser.set(row.user_id, list)
  }
  const dayData: Record<string, StoredDayData> = {}
  for (const row of days.data ?? []) dayData[row.challenge_id] = row.data as StoredDayData

  const open = new Set<string>()
  for (const u of users) {
    if (todayNeedsMaking(byUser.get(u.id) ?? [], dayData, u.tz, u.late_night_buffer_hrs, now)) {
      open.add(u.id)
    }
  }
  return open
}
