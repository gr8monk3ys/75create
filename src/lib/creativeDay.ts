// The creative-day rule lives with the Edge Functions (they deploy on their
// own and can only import from supabase/functions), so the app and the
// server reminders share one copy of "what day is it".
export * from '../../supabase/functions/_shared/creativeDay'
