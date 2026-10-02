# Product

<!-- impeccable:product-schema 1 -->

> Inferred during `/impeccable init` from the repository (README, design spec in
> `docs/superpowers/specs/`, landing copy, `CONTEXT.md`) because the owner
> delegated the interview ("go with your recommended answers"). Facts marked
> _(inferred)_ are hypotheses to confirm, not decisions the owner made.

## Platform

web

(Installable PWA, mobile-first; no native app.)

## Users

- **Primary:** a person with a creative practice (writing, drawing, music, photography, video, code art, mixed) who wants to make it daily, and who knows the 75 Hard / 75 Fluent format or responds to it. They check in on a phone, often late in the evening, once a day. _(inferred)_
- **Situation:** they have started and abandoned creative habits before; the challenge format (fixed rules, a visible streak, real stakes for a miss) is the thing they are buying into. _(inferred from landing copy: "the top reason people quit for good")_
- **Secondary:** people a participant shares progress with, viewing a read-only share link. They have no account.

## Product Purpose

75 Create is a free tracker for a 75-day creative discipline challenge: pick a medium, commit to 3 to 7 daily rules (five by default), check in every day for 75 days, and finish with 75 days of documented work. Success for a user is finishing the 75 days, or honestly restarting under the rules they chose. Success for the product is that the daily check-in takes seconds and the grid makes progress (and misses) impossible to ignore.

## Positioning

The 75 Hard format applied to creative output rather than fitness: the stakes are chosen up front and locked (Classic reset, Grace skip tokens, or Extend), the rules are the person's own, and the proof is the work itself (a daily log and an artifact), not a checkbox. The 75-cell grid is the product's signature and its share image.

## Operating Context

- The daily loop: open the app, check the day's rules, write a one-to-three sentence log, capture an artifact (image or link). Usually on a phone, one-handed. _(inferred)_
- The creative day includes a late-night buffer (default 3 hours) so post-midnight work still counts for the previous day.
- A missed day is stated factually and the person's own "why I started" note is shown back to them.
- Milestones at days 7, 25, 50 and 75; a recap and downloadable certificate at the end; optional maintenance mode afterwards.
- Works offline and without an account backend; optional Supabase backend adds real auth, cross-device sync, and push/email reminders.

## Capabilities and Constraints

- Local-first: all reads are local; with Supabase configured, writes are mirrored through an outbox (last-write-wins).
- Private by default: share links carry a snapshot in the URL fragment; logs only if the owner opts in; artifacts are never shared.
- Rules lock at start; the miss policy locks at start.
- Honor system: there is no verification that work happened.
- Free, no ads (stated on the landing page). No pricing, no paid tier.
- Undecided: buddy connections, cohorts, public gallery, localization (listed as post-MVP in the spec).

## Brand Commitments

- Name: **75 Create**.
- The existing visual identity, "the daily mark" (riso pigment on sketch paper; Bricolage Grotesque, Instrument Sans, Space Mono; cobalt, coral, marigold pigments), is the incumbent design authority. Refinements preserve it.
- Voice: plain, direct, a little dry; calm by default, celebratory on completion; missed days stated factually, never shamed. _(inferred from copy)_

## Evidence on Hand

- No testimonials, user counts, press, or case studies exist. Do not invent any.
- The landing grid is a deterministic sample (Day 34), not a real user's data, and must stay presented as an example.

## Product Principles

1. The daily check-in is the product: it must take seconds, one-handed, and never lose what was typed.
2. The rules you chose are the rules: stakes are explicit up front and never softened after the fact.
3. Show the truth kindly: misses are visible and factual, paired with the person's own reason for starting.
4. Private by default: nothing leaves the device or reaches another person without an explicit choice.
5. The grid is the reward: progress should look like something worth screenshotting.

## Accessibility & Inclusion

WCAG 2.2 AA as the working standard _(inferred; no requirement stated)_: keyboard-completable check-in, visible focus, 44px touch targets (already enforced by the mobile e2e suite), reduced-motion alternatives for celebrations, and grid states that do not rely on colour alone.
