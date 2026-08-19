# 75 Create

A free, zero-friction tracker for a **75-day creative discipline challenge** — the
75 Hard / 75 Fluent format, adapted for creative work. Do five daily tasks for 75
days, keep a streak, log the work, and walk away with 75 days of documented output.

This repository is a **local-first MVP**: it runs entirely in the browser with no
backend, so you can `bun dev` and use it immediately. All persistence goes
through a `Repository` interface (localStorage + IndexedDB today) that is designed
to be swapped for Supabase later without touching feature code.

## Quick start

Requires [Bun](https://bun.sh) ≥ 1.2 (the version in `packageManager` is what CI
uses). Bun is the package manager, script runner, and test runner; there is no
npm lockfile.

```bash
bun install
bun dev            # http://localhost:3000
bun test           # unit tests (bun:test)
bun run lint       # ESLint (flat config, next/core-web-vitals)
bun run typecheck  # tsc --noEmit
bun run build      # production build (regenerates PWA icons first)
bun run check      # everything CI runs
```

## What's built (MVP F1–F10)

- **Auth** — passwordless local sign-in (prototype: magic link / OAuth are stubbed).
- **Setup wizard** — medium, customizable rules (3–7, lock at start), miss policy,
  start date, and a "why I started" note.
- **Daily check-in** — task checkboxes, ≤500-char log, image artifact (compressed,
  ≤5 MB) or link, all autosaved.
- **The grid** — the signature 75-cell hand-stamped pigment grid; streak + day
  counter always visible.
- **Miss-policy engine** — Classic / Grace (3 skip tokens) / Extend, applied at day
  rollover per the user's timezone and late-night buffer. Failed attempts are
  archived, never deleted.
- **Reminders** — opt-in daily browser notification (email needs the future server).
- **Recap & certificate** — Day-75 recap with an artifact timeline and a downloadable
  certificate PNG; maintenance mode and new-round options.
- **Share link** — read-only page that carries a progress snapshot in the URL
  fragment (owner opts into including logs; artifacts are never shared).
- **Export** — one-click ZIP of logs (JSON + CSV) and artifact images.
- **Account deletion** — immediate, permanent local wipe.

Plus milestone celebrations (days 7/25/50) and the why-note resurfaced on a missed
day.

## Architecture

- **Next.js (App Router) + TypeScript + Tailwind**, styled-jsx for component styles.
- **Bun** for installs, scripts, and tests (`bun test` with happy-dom +
  fake-indexeddb, wired up in `tests/setup.ts` via `bunfig.toml`).
- `src/lib/challengeEngine.ts` — pure, deterministic day/streak/miss-policy logic
  (time is injected, never read inside). This is the tested correctness core.
- `src/lib/repository.ts` + `localRepository.ts` — persistence abstraction.
- `src/components/AppProvider.tsx` — loads state, runs rollover, exposes `useApp()`.

See `docs/superpowers/specs/` for the design spec and `docs/superpowers/plans/` for
the implementation plan.

## Design

"The daily mark" — riso pigment on sketch paper. The filling 75-cell grid is the
brand and the growth loop (built to be screenshot-shared). Bricolage Grotesque /
Instrument Sans / Space Mono. Calm by default, celebratory on completion; private by
default.

## Install as an app

75 Create is an installable PWA: full icon set, offline support via a service
worker (network-first navigations, cached app shell), and standalone display.
On mobile, use "Add to Home Screen"; on desktop Chrome/Edge, use the install
icon in the address bar. Since all state is local, the installed app works
fully offline after the first visit.

## Optional server backend (Supabase)

The app is fully functional with no server. To turn on **real auth (magic
link / Google)** and **cross-device sync**:

1. Create a Supabase project and run `supabase/migrations/0001_init.sql`
   (tables + RLS + the private `artifacts` storage bucket).
2. Enable the Email (magic link) and Google providers under Auth.
3. Build with the env vars:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```

Set `NEXT_PUBLIC_SITE_URL` to the deployed origin as well, so Open Graph images
in link previews resolve against the real domain instead of `localhost`. (On
Vercel this falls back to the production URL automatically.)

Without those vars, nothing changes — prototype local sign-in, single device.
With them, the server session becomes the source of truth for auth, and a
write-through outbox (`src/lib/syncedRepository.ts`) mirrors every local
mutation to Postgres (JSONB rows, last-write-wins) and artifact images to
Storage. The app stays local-first: reads are always served locally, so
offline keeps working; the outbox flushes when back online.

**Email reminders:** deploy `supabase/functions/send-reminders` and schedule
it every 15 minutes; it emails users at their chosen reminder time via Resend
(`RESEND_API_KEY` + `REMINDER_FROM` secrets). Browser-notification reminders
fire client-side with no server at all.

## Status

Feature-complete product: web app + installable offline PWA, with an optional
Supabase backend (auth, sync, email reminders) that activates via env vars.
Full account deletion of the *auth user* (not just data) still requires the
Supabase dashboard or a service-role function.
