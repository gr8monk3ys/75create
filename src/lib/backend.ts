// Whether a Supabase backend is configured, decided from the build-time env
// alone. Kept apart from `./supabase` so checking costs nothing: the SDK is
// only downloaded when this is true.

export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)
