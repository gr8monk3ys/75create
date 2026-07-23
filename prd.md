# PRD: 75 Create — Free Challenge Tracking Platform

**Version:** 0.1 (Draft)
**Status:** For review
**Author:** [Your name]
**Last updated:** July 23, 2026

---

## 1. Overview

75 Create is a free web platform for a 75-day creative discipline challenge, modeled on the format popularized by 75 Hard (fitness/mental toughness) and 75 Fluent (language learning). Users commit to a set of daily creative tasks for 75 consecutive days and use the platform to check off tasks, maintain a streak, log their work, and see their progress over time.

The reference product is the 75 Fluent tracker (75-fluent.com): a lightweight, free, single-purpose tracker built around a fixed rule set. 75 Create follows the same philosophy — do one thing extremely well (daily challenge tracking) — while adapting the rules to creative work and adding a light portfolio element, since creative output is inherently shareable in a way that study minutes are not.

### Problem statement

Creative people struggle with consistency more than with skill. Existing tools are either generic habit trackers (no challenge identity, no rules, no finish line) or heavyweight community platforms (high friction, social pressure before habit exists). There is no free, zero-friction tracker purpose-built for a creative 75-day challenge with a defined rule set, a clear end date, and a built-in record of what was made.

### Product vision

The simplest possible way to start, track, and finish a 75-day creative challenge — and walk away with 75 days of documented creative output.

---

## 2. Goals and non-goals

### Goals

1. Let a user go from landing page to Day 1 checked off in under 3 minutes.
2. Make daily check-in take under 60 seconds on mobile or desktop.
3. Give users a motivating, visual sense of progress (streak, grid, artifacts).
4. Produce a tangible payoff at Day 75: an auto-generated recap of the full challenge.
5. Operate at near-zero cost so the platform can remain free indefinitely.

### Non-goals (v1)

- Native mobile apps (responsive web only; PWA install prompt is acceptable).
- Social network features: following, feeds, comments, likes.
- Paid tiers, ads, or any monetization.
- Teaching content (tutorials, courses, prompts marketplace).
- Verification/anti-cheat. The challenge is on the honor system, as with 75 Hard.

---

## 3. Target users and personas

**Persona A — "The Restarter" (primary).** Hobbyist artist/writer/musician, 20–40, has started and abandoned creative habits repeatedly. Motivated by structure and streaks. Found the challenge via TikTok/YouTube/Reddit. Wants rules handed to them.

**Persona B — "The Customizer."** Experienced creative who likes the 75-day format but wants to tune the rules to their discipline (e.g., a filmmaker swapping "daily study" for "daily footage review"). Will abandon the product if rules are rigid in the wrong places.

**Persona C — "The Accountability Pair."** Two friends doing the challenge together. Doesn't want a community; wants to see one or two specific people's progress.

---

## 4. The challenge rules (default rule set)

The platform ships with a default 75 Create rule set. Five daily tasks, all required, every day for 75 days:

1. **Create for 30+ minutes.** Work on your craft: draw, write, compose, film, code art — anything generative in your chosen medium.
2. **Study one piece of work in your medium.** Actively analyze something good (a painting, a chapter, a track) — not passive scrolling.
3. **Log the day.** A short note (1–3 sentences) on what you made or learned. Doubles as the daily proof-of-work.
4. **Capture an artifact.** Upload or link a photo, snippet, or excerpt of the day's work (private by default).
5. **No passive consumption of your medium before creating.** The day's first engagement with your craft must be making, not scrolling.

**Miss policy (user-selectable at challenge start, locked afterward):**

- **Classic:** any missed day resets to Day 1 (75 Hard style).
- **Grace:** 3 lifetime "skip tokens"; a fourth miss resets.
- **Extend:** a missed day adds a day to the end; streak display resets but the challenge continues.

Rationale: the full-reset rule is iconic but is also the most cited reason people quit challenges entirely. Offering the choice up front (and locking it, so it can't be softened mid-challenge) preserves both the hardcore identity and realistic completion rates.

**Custom rules (Persona B):** users may edit task names/descriptions and add/remove tasks (minimum 3, maximum 7) before Day 1. Rules lock once the challenge starts.

---

## 5. Core user flows

### 5.1 Onboarding (first session)

1. Landing page: what the challenge is, the 5 rules, a "Start my 75" CTA.
2. Sign up: email magic link or OAuth (Google/Apple). No passwords.
3. Setup wizard (3 steps): choose medium (writing, drawing, music, photography, video, code/generative, mixed, other) → accept default rules or customize → choose miss policy and start date (today or a future date).
4. Land on the dashboard at Day 0/1 with an empty 75-cell grid.

### 5.2 Daily check-in (the core loop)

1. User opens the site (or taps the daily reminder notification/email).
2. Dashboard shows today's card: 5 checkboxes, a text field for the log, an upload/link field for the artifact.
3. Checking all required items marks the day complete; the grid cell fills in and the streak counter increments with a small celebration animation.
4. Day boundaries follow the user's local timezone; a day can be completed until 3:00 a.m. the following day (configurable "late-night buffer" for night-owl creatives).

### 5.3 Missing a day

- At the end of an incomplete day, the outcome of the user's chosen miss policy is applied automatically and explained in plain language ("You used skip token 2 of 3").
- Classic-mode resets show a "Restart at Day 1" confirmation with the previous attempt archived, not deleted — prior logs and artifacts remain viewable under "Past attempts."

### 5.4 Finishing

- Day 75 completion triggers a recap page: total minutes, longest streak, the full artifact gallery as a scrollable timeline, and a shareable certificate image (PNG with stats, no artifacts unless the user opts in).
- Post-challenge prompt: start a new round, or switch to a maintenance mode ("Create daily, no rules") that keeps the check-in habit without challenge stakes.

### 5.5 Accountability (Persona C)

- A user can generate a private share link. Anyone with the link sees a read-only progress page: grid, streak, and (only if the owner opts in) daily logs/artifacts.
- Optional "buddy" connection: two users link accounts and see each other's daily completion status on their own dashboards. No comments, no likes.

---

## 6. Feature requirements

### 6.1 MVP (launch)

| # | Feature | Requirement |
|---|---------|-------------|
| F1 | Auth | Email magic link + Google OAuth. Session persistence 90+ days. |
| F2 | Challenge setup | Medium selection, default rules, rule customization (3–7 tasks), miss policy, start date. Rules lock at start. |
| F3 | Daily check-in | Task checkboxes, daily log (max 500 chars), artifact upload (image up to 5 MB) or external URL. Autosave. |
| F4 | Progress grid | 75-cell visual grid (complete / missed / skipped / future). Current streak and day counter always visible. |
| F5 | Miss-policy engine | Automatic day rollover per user timezone; applies Classic/Grace/Extend logic; archives failed attempts. |
| F6 | Reminders | Opt-in daily email at a user-chosen time. (Push notifications if PWA is installed.) |
| F7 | Recap & certificate | Auto-generated Day 75 recap page and downloadable certificate image. |
| F8 | Read-only share link | Tokenized public progress page with owner-controlled visibility of logs/artifacts. |
| F9 | Data export | One-click export of all logs and artifact files (ZIP + JSON/CSV). |
| F10 | Account deletion | Self-serve, immediate, permanent. |

### 6.2 Post-MVP (v1.x candidates, in priority order)

1. Buddy connections (mutual dashboard visibility).
2. PWA polish: offline check-in with sync, install prompts, local notifications.
3. Community start dates ("cohorts") — everyone starting on the 1st of a month sees an anonymous aggregate ("2,314 people are on Day 12 with you").
4. Public opt-in gallery of Day-75 recaps.
5. Additional rule-set templates contributed by users (75 Write, 75 Draw, 75 Compose).
6. Localization (challenge culture is strong in non-English TikTok communities).

### 6.3 Explicitly deferred

Comments/DMs (moderation burden), streak leaderboards (encourages cheating and unhealthy comparison), AI features of any kind (not needed for v1; adds cost against the free model).

---

## 7. Design principles

1. **One screen matters:** the daily check-in. Everything else is secondary navigation.
2. **Mobile-first.** The check-in happens on phones at 11 p.m.; design for one thumb.
3. **Calm by default, celebratory on completion.** No guilt UX. A missed day is stated factually; a completed day gets the dopamine.
4. **The grid is the brand.** The filling 75-cell grid should be distinctive enough to be screenshot-shared organically (this is the primary growth loop — mirror how 75 Hard spreads via progress-pic posts).
5. **Private by default.** Artifacts and logs are visible to no one unless explicitly shared.

---

## 8. Technical approach (proposed)

Chosen to keep a free product sustainable at low cost:

- **Frontend:** Next.js (or SvelteKit) responsive web app, deployed on a free/cheap edge host (e.g., Vercel/Netlify/Cloudflare Pages). PWA manifest from day one.
- **Backend/DB:** Managed Postgres + auth (e.g., Supabase or equivalent) — magic links, OAuth, and row-level security out of the box.
- **Storage:** Object storage for artifacts (e.g., Cloudflare R2 for zero egress fees). 5 MB/image cap, client-side compression before upload; per-user storage cap ~500 MB.
- **Email:** Transactional provider free tier (magic links + reminders).
- **Day rollover:** computed from stored user timezone at read time; a scheduled job finalizes day states and applies miss policies.

**Core data model (simplified):** `users` → `challenges` (rules JSON, miss policy, start date, status) → `days` (index 1–75, state, completed_at) → `task_checks`, `logs`, `artifacts`. Failed attempts keep their `challenge` row with status `archived`.

**Estimated run cost:** near-zero to low tens of dollars/month up to ~10k active users, dominated by image storage. This is the load-bearing assumption behind "free forever"; the 5 MB cap and compression are requirements, not nice-to-haves.

---

## 9. Success metrics

| Metric | Target (6 months post-launch) |
|---|---|
| Activation: % of signups completing Day 1 | ≥ 60% |
| D7 retention (still checking in at Day 7) | ≥ 40% |
| Challenge completion rate (reach Day 75, any policy) | ≥ 8% (75-Hard-style challenges are famously low; 8% is ambitious) |
| Median daily check-in time | ≤ 60 seconds |
| Organic share rate (share links or certificate downloads / completions) | ≥ 30% |
| Infrastructure cost per MAU | ≤ $0.01 |

Guardrail metrics: reminder-email unsubscribe rate < 10%; account deletion rate < 2%/month.

---

## 10. Risks and open questions

**Risks**

1. **Motivation cliff (Days 8–20).** Most abandonment happens after novelty fades. Mitigations: milestone celebrations at Days 7/25/50, "why I started" note captured at setup and resurfaced on missed days.
2. **Storage cost creep** if video uploads are ever allowed. Mitigation: images + external links only in v1.
3. **Trademark adjacency.** "75 Hard" is Frisella's trademarked program; the platform must use its own name/branding, not claim affiliation, and describe the format generically. (Worth a quick legal review before launch — this PRD is not legal advice.)
4. **Honor-system fragility.** Without verification, streaks can be faked. Accepted: the product serves people who want the discipline, not a competition.

**Open questions**

1. Should the default rule set require the artifact upload daily, or make it optional with the written log as the only mandatory proof? (Friction vs. payoff trade-off.)
2. Is "no passive consumption before creating" (Rule 5) enforceable enough to feel meaningful, or should it be replaced with a positively-framed rule?
3. Cohorts in MVP or post-MVP? They aid retention but add scope.
4. Name/domain availability for "75 Create."

---

## 11. Release plan

- **M0 — Prototype (2–3 wks):** auth, setup wizard, daily check-in, grid, Classic policy only. Dogfood with 10 users.
- **M1 — Private beta (4–6 wks):** all miss policies, reminders, artifacts, export, deletion. 100–500 users recruited from creative-challenge communities.
- **M2 — Public launch:** recap/certificate, share links, landing page, PWA basics. Launch aligned to a natural start date (e.g., the 1st of a month or New Year) to seed an implicit cohort.
- **M3 — v1.x:** buddy connections, cohorts, template library — prioritized by beta feedback.