// Optional Supabase backend. The app is local-first and fully functional with
// no server; setting NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
// at build time turns on real auth (magic link / Google) and cross-device sync.

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null

export function isSupabaseConfigured(): boolean {
  return supabase !== null
}

/** Storage bucket holding artifact images, one folder per user id. */
export const ARTIFACTS_BUCKET = 'artifacts'
