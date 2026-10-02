# An optional backend, beyond the MVP's non-goals

The MVP spec (§2) listed real email delivery, real OAuth and magic links, and
cross-device sync as non-goals: the MVP was local-only. This branch was asked
to make the product production-ready "like 75 Hard", and a 75-day commitment
that lives in one browser can be lost to a cleared cache or a new phone, so
the optional Supabase backend (real auth, sync, server reminders) is built.

It stays optional and local-first, so the MVP's shape holds:

- With no backend configured, nothing changes: sign-in is "continue on this
  device", every read and write is local, and the Supabase SDK is never
  downloaded.
- With one, reads are still served locally; an outbox mirrors writes, and
  day data is merged across devices rather than last-write-wins, so sync can
  never cost a made day (see `mergeDayData` and the session's reconcile).
