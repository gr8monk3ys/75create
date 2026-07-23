# Design: 75 Create — MVP (local-first)

**Date:** 2026-07-23
**Status:** Approved
**Source PRD:** `prd.md`

---

## 1. Goal

Build the full MVP (F1–F10) of the 75 Create challenge tracker described in `prd.md`,
as a **local-first** Next.js web app that runs immediately with `npm run dev` — no cloud
accounts or credentials. The data layer sits behind a repository interface so it can later
be swapped for Supabase without touching feature code.

## 2. Non-goals (this build)

- Real email delivery, real OAuth, real magic links (require a server — stubbed locally).
- Cross-device sync (local-first; the share link carries a static snapshot instead).
- Buddy connections, cohorts, public gallery, localization (PRD post-MVP).
- Native apps.

## 3. Tech stack

- **Next.js (App Router) + TypeScript.**
- **Tailwind CSS** for styling, mobile-first.
- **Vitest** for unit tests over pure logic.
- **JSZip** for export; **browser Canvas** for the certificate; **Notifications API** for reminders.
- PWA manifest from day one.

## 4. Architecture

### 4.1 Repository abstraction

All feature code talks to a `Repository` interface — never to `localStorage` directly.

```
Repository
  getUser() / saveUser() / deleteAllData()
  getChallenges() / saveChallenge() / getActiveChallenge()
  getDays(challengeId) / saveDay()
  getArtifact(id) / saveArtifact(blob) / deleteArtifact()   // blobs → IndexedDB
```

- **v1 implementation:** `LocalRepository` — structured data in `localStorage` under a
  single namespaced root key; artifact image blobs in `IndexedDB` (localStorage cannot
  hold 5 MB images).
- **Future:** `SupabaseRepository` implements the same interface. Only this module changes.

### 4.2 Day rollover & miss-policy engine (pure, unit-tested)

A pure module `challengeEngine` computes, from stored timestamps + user timezone:

- Which day index "today" is, honoring the configurable late-night buffer (default 3 a.m.).
- The state of every day: `future | complete | missed | skipped`.
- Application of the miss policy when an incomplete day rolls over:
  - **Classic:** any miss → archive attempt, restart at Day 1.
  - **Grace:** 3 lifetime skip tokens; the 4th miss → reset.
  - **Extend:** a miss adds a day to the end; streak display resets, challenge continues.
- Current streak and longest streak.

This module has no I/O and no `Date.now()` baked in — the current time is passed in — so it
is fully deterministic and testable. It is the load-bearing correctness surface.

### 4.3 App state

React context (`AppProvider`) loads the repository on mount, runs the rollover check, and
exposes user + active challenge + derived day states to the tree. Feature screens are
client components subscribing to this context.

## 5. Data model

```
user      { id, email, tz, lateNightBufferHrs, createdAt, reminderTime|null }
challenge { id, medium, rules[], missPolicy, startDate, status,
            skipTokensUsed, whyNote, createdAt, maintenanceMode }
rule      { id, name, description, required }            // 3–7 rules, locked at start
day       { challengeId, index(1..75), state, completedAt|null }
taskCheck { dayId, ruleId, checked }
log       { dayId, text(≤500), updatedAt }
artifact  { id, dayId, kind: 'image'|'url', blobRef|url, createdAt }
```

Archived attempts keep their `challenge` row with `status: 'archived'`; their logs and
artifacts remain viewable under "Past attempts".

## 6. Feature map (F1–F10)

| # | Feature | Implementation |
|---|---------|----------------|
| F1 | Auth | Passwordless local sign-in by email; session in localStorage. Magic-link/OAuth UI present but stubbed and labeled "prototype auth". |
| F2 | Challenge setup | Wizard: medium → rules customize (3–7) → miss policy → start date (today/future). Rules lock at start. |
| F3 | Daily check-in | Task checkboxes, daily log (≤500 chars), artifact upload (image ≤5 MB, client-compressed → IndexedDB) or external URL, autosave. |
| F4 | Progress grid | 75-cell grid (complete/missed/skipped/future); current streak + day counter always visible. The brand screen. |
| F5 | Miss-policy engine | `challengeEngine` (§4.2). |
| F6 | Reminders | Opt-in daily time; browser Notifications API. Email path stubbed with a visible note. |
| F7 | Recap & certificate | Day-75 recap page (total minutes est., longest streak, artifact timeline) + downloadable certificate PNG via Canvas. |
| F8 | Share link | Read-only page reading a progress snapshot encoded in the URL fragment; owner toggles inclusion of logs/artifacts. |
| F9 | Export | Client-side ZIP: `logs.json`, `logs.csv`, artifact image files. |
| F10 | Account deletion | Immediate permanent wipe of localStorage + IndexedDB. |

## 7. Added features (approved extras)

1. **"Why I started" note** captured at setup, resurfaced on missed days.
2. **Milestone celebrations** at Days 7 / 25 / 50.
3. **Maintenance mode** ("Create daily, no rules") offered post-Day-75.

## 8. Design principles honored

- One screen matters: the daily check-in / dashboard.
- Mobile-first, one-thumb check-in.
- Calm by default, celebratory on completion; missed days stated factually.
- The grid is the brand — distinctive and screenshot-shareable.
- Private by default.

## 9. Testing strategy

- **Unit (Vitest):** `challengeEngine` — day-index math, timezone + late-night buffer,
  all three miss policies, streak/longest-streak, archive-on-reset. This is where bugs
  would be most costly, so coverage concentrates here.
- **Lighter coverage** on repository serialization round-trips and share-snapshot encode/decode.
- UI is validated by running the app.

## 10. Build sequence

1. Scaffold Next.js + Tailwind + Vitest; PWA manifest.
2. Types + `challengeEngine` (TDD) + tests.
3. `Repository` interface + `LocalRepository` (localStorage + IndexedDB) + round-trip tests.
4. `AppProvider` context + rollover-on-load.
5. Auth (F1) + setup wizard (F2).
6. Dashboard: grid (F4) + daily check-in (F3).
7. Miss-policy wiring + past attempts (F5).
8. Reminders (F6), recap/certificate (F7), share link (F8), export (F9), deletion (F10).
9. Added extras (why-note, milestones, maintenance mode).
10. Polish, mobile pass, run-through.
