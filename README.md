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
bun run check      # lint + typecheck + unit tests
bun run test:e2e   # Playwright, against a real production build
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

1. Create a Supabase project and run the migrations in order:
   `supabase/migrations/0001_init.sql` (tables + RLS + the private `artifacts`
   storage bucket), then `0002_hardening.sql` (server-owned `updated_at`,
   policies scoped to authenticated users, reminder index).
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
it every 15 minutes; it emails users at their chosen reminder time via Resend.
Set three function secrets: `RESEND_API_KEY`, `REMINDER_FROM` (a verified
sender), and `REMINDER_SECRET`. The scheduler must send that secret as an
`x-reminder-secret` header — without it the function refuses the request, so
the URL isn't an open email-sending endpoint billed to your account.

**Push notifications (the one that reaches phones):** run
`supabase/migrations/0003_push.sql`, generate a VAPID key pair
(`npx web-push generate-vapid-keys`), then:

- build with `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>`;
- deploy `supabase/functions/send-push` with secrets `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:` or `https:` contact URL)
  and `PUSH_SECRET`, and schedule it every 15 minutes with an
  `x-push-secret` header.

Turning on the reminder in settings then subscribes that device, and the
notification arrives with the app closed. On iOS this requires the app to be
added to the Home Screen (16.4+) — in a Safari tab, no web notification of any
kind is possible.

**Browser notifications** fire client-side with no server, but only while the
app is open, and not at all on iOS — Safari doesn't implement the `Notification`
constructor. They remain the fallback when push isn't configured.

**Account deletion:** deploy `supabase/functions/delete-account` (leave JWT
verification on — it deletes whoever is calling, and takes no user id). The app
invokes it after wiping local and remote data, so deleting an account really
removes the auth user rather than leaving one that can sign back in. Without it
deployed the data is still deleted; only the account record survives.

### Error reporting

Set `NEXT_PUBLIC_ERROR_ENDPOINT` to a URL that accepts a JSON POST and every
error boundary, unhandled rejection and window error is reported to it. Without
it, errors are logged to the console and nothing leaves the device.

## Status

Feature-complete product: web app + installable offline PWA, with an optional
Supabase backend (auth, sync, email reminders) that activates via env vars.

Known gaps before this is safe to hand to strangers:

- **Push delivery is unverified end to end.** The client subscription, service
  worker handlers, VAPID signing (unit-tested against WebCrypto) and sender are
  all in place, but no push has been delivered through a real push service —
  that needs VAPID keys and a deployed function.
- **Local-only by default.** Without Supabase configured, a cache clear loses the
  challenge — and on iOS, Safari caps script-writable storage at seven days for
  a site that isn't installed to the home screen.
- There is **no native mobile app** — the mobile experience is the PWA.
