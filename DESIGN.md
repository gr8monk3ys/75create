---
name: 75 Create
description: A 75-day creative challenge tracker drawn as riso pigment on sketch paper.
colors:
  paper: "#efe9dc"
  paper-2: "#e7e0d1"
  paper-3: "#ded5c2"
  ink: "#1b1a17"
  ink-soft: "#4a463d"
  muted: "#625b4e"
  line: "#d6ccb8"
  field-border: "#837968"
  cobalt: "#2340d8"
  coral: "#f5462d"
  coral-ink: "#ad2f1a"
  marigold: "#e0910f"
  marigold-ink: "#8c5906"
  pink: "#ff48b0"
  moss: "#2f7d4f"
  cell-today: "#e03d24"
  cell-missed: "#7d7463"
  paper-dark: "#15140f"
  paper-2-dark: "#1e1c16"
  ink-dark: "#f3ecdd"
  muted-dark: "#9a9382"
  cobalt-dark: "#6f85ff"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Trebuchet MS, sans-serif"
    fontSize: "clamp(3rem, 9vw, 5.5rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.02em"
  display-sm:
    fontFamily: "Bricolage Grotesque, Trebuchet MS, sans-serif"
    fontSize: "clamp(2.4rem, 8vw, 4rem)"
    fontWeight: 800
    lineHeight: 0.98
  headline:
    fontFamily: "Bricolage Grotesque, Trebuchet MS, sans-serif"
    fontSize: "clamp(1.8rem, 5vw, 2.7rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.02em"
  page-title:
    fontFamily: "Bricolage Grotesque, Trebuchet MS, sans-serif"
    fontSize: "clamp(2rem, 6vw, 3rem)"
    fontWeight: 800
    lineHeight: 0.98
  card-title:
    fontFamily: "Bricolage Grotesque, Trebuchet MS, sans-serif"
    fontSize: "clamp(1.5rem, 5vw, 1.9rem)"
    fontWeight: 800
    lineHeight: 1
  heading-sm:
    fontFamily: "Bricolage Grotesque, Trebuchet MS, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1
  title-lg:
    fontFamily: "Bricolage Grotesque, Trebuchet MS, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.1
  title:
    fontFamily: "Bricolage Grotesque, Trebuchet MS, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.1
  lead:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  note:
    fontFamily: "Space Mono, ui-monospace, monospace"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Space Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    letterSpacing: "0.14em"
  label-xs:
    fontFamily: "Space Mono, ui-monospace, monospace"
    fontSize: "0.7rem"
    fontWeight: 700
  numeral-xl:
    fontFamily: "Bricolage Grotesque, Trebuchet MS, sans-serif"
    fontSize: "clamp(2.8rem, 12vw, 4.5rem)"
    fontWeight: 800
    fontFeature: "tnum"
  numeral:
    fontFamily: "Bricolage Grotesque, Trebuchet MS, sans-serif"
    fontSize: "clamp(1.8rem, 7vw, 2.6rem)"
    fontWeight: 800
    fontFeature: "tnum"
rounded:
  compact: "2px"
  cell: "4px"
  field: "10px"
  panel: "14px"
  pill: "999px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1.25rem"
  lg: "1.5rem"
  xl: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0.85rem 1.4rem"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.85rem 1.4rem"
  button-danger:
    backgroundColor: "{colors.coral-ink}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0.6rem 0.8rem"
    height: "44px"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.55rem 1.1rem"
    height: "44px"
  panel:
    backgroundColor: "{colors.paper-2}"
    rounded: "{rounded.panel}"
  grid-cell-made:
    backgroundColor: "{colors.cobalt}"
    rounded: "{rounded.cell}"
---

# Design System: 75 Create

## Overview

**Creative North Star: "The Daily Mark"**

Every screen is a sheet of sketch paper with pigment printed onto it. The paper is warm and dotted like a notebook grid. The pigments are the flat, slightly off-register colours of a risograph: cobalt for work made, marigold for a day a skip token covered, coral for today, and a hatched grey-brown for a day that was missed. The product's single image, the 75-cell grid, is made of those marks, and the rest of the interface borrows its vocabulary from it: stamps, offsets and small rotations that read as placed by hand.

It is calm by default and celebratory only when a day is done. Density is low and one-handed: a phone at night is the main use scene, so everything the day needs sits in one card and every control is at least 44px. The voice is plain and a little dry. Misses are stated as facts in ink, never shouted in red.

**Key Characteristics:**
- Warm paper grounds with a dotted sketch-paper texture, in light and dark.
- Flat riso pigments with meaning: each colour is a day state, not decoration.
- Hand-placed marks: grid stamps rotate ±3.5°, the Done stamp −3°.
- Misregistered offset shadows as the only depth, with no blur.
- One display face with real weight, one plain body face, and mono for labels and numbers.

## Colors

A cream paper and ink base with five riso pigments, each tied to a meaning.

### Primary
- **Riso Cobalt** (#2340d8, dark #6f85ff): a day made. Grid stamps, the completed check-in's offset, selected choices, links, the focus ring. It is the colour of progress, so it never marks anything else.

### Secondary
- **Riso Coral** (#f5462d): today and the moment of a stake. The today ring (deepened to #e03d24 so it clears 3:1), the reset banner's offset, the button hover offset. As text it becomes **Coral Ink** (#ad2f1a, dark #ff7a63).
- **Riso Marigold** (#e0910f): a day covered by a skip token, and Grace's token chips. As text it becomes **Marigold Ink** (#8c5906, dark #f0b04a).

### Tertiary
- **Pink** (#ff48b0) and **Moss** (#2f7d4f): confetti only.

### Neutral
- **Sketch Paper** (#efe9dc, dark #15140f): the page ground.
- **Paper Two / Three** (#e7e0d1 / #ded5c2): panels and insets, a step darker each.
- **Ink** (#1b1a17, dark #f3ecdd): all primary text and the primary button.
- **Soft Ink** (#4a463d): body copy on panels.
- **Muted** (#625b4e, dark #9a9382): secondary text. Tuned to at least 4.5:1 on every paper tone.
- **Line** (#d6ccb8): hairline dividers and panel edges.
- **Field Border** (#837968, dark #7a7362): the edge of anything you type into or pick. At least 3:1, so a field reads as a field.
- **Missed** (#7d7463, dark #7a7362): the missed-day hatch. At least 3:1, and deliberately uncoloured.

### Named Rules
**The Pigment Means Something Rule.** Each pigment is a day state first. Cobalt is made, marigold is skipped, coral is today and stakes. Don't borrow a pigment for decoration where it could be read as a state.

**The Ink For Text Rule.** Raw pigments are fills. Text in a pigment colour uses its `-ink` variant, which clears 4.5:1.

**The Miss Is A Fact Rule.** A missed day is hatched in neutral ink tone with a × mark, never coral or red. It must be visible (at least 3:1) and never shaming.

## Typography

**Display Font:** Bricolage Grotesque (with Trebuchet MS)
**Body Font:** Instrument Sans (with system-ui)
**Label/Mono Font:** Space Mono (with ui-monospace)

**Character:** A chunky, slightly quirky grotesque at weight 800 carries headings and numbers like hand-lettered signage. A neutral sans keeps the reading quiet. A typewriter mono labels things and counts days.

### Hierarchy
One ramp, nothing between its steps:
- **Display** (800, clamp(3rem, 9vw, 5.5rem), 0.98): the landing hero. **Display small** (clamp(2.4rem, 8vw, 4rem)): the recap headline.
- **Headline** (800, clamp(1.8rem, 5vw, 2.7rem)): landing section titles. **Page title** (clamp(2rem, 6vw, 3rem)): inner page titles (Settings, Setup, Share).
- **Card title** (800, clamp(1.5rem, 5vw, 1.9rem)): the check-in date and the celebration.
- **Heading small / Title large / Title** (800, 2rem / 1.5rem / 1.25rem): panel, banner, section and detail titles.
- **Lead** (400, 1.125rem): landing lede, attempt names. **Body** (400, 1rem, 1.5): all reading copy, 60ch maximum in banners and help. **Small** (400, 0.875rem): secondary copy (rule notes, meta, lists).
- **Note** (Space Mono, 0.8rem): multi-line notes, meta lines, links in mono. **Label** (Space Mono, 0.75rem, 0.08–0.16em tracking, uppercase for stat labels): stat labels, counters, key hints. **Label XS** (Space Mono 700, 0.7rem): the × and – marks inside grid cells on small screens only.
- **Numerals** (Bricolage 800, tabular): clamp(2.8rem, 12vw, 4.5rem) for the day count, clamp(1.8rem, 7vw, 2.6rem) for streaks and recap facts.

### Named Rules
**The No Kicker Rule.** No small label sits above a heading. The heading carries its own weight. Mono labels name stats and fields, never sections.

**The 11px Floor Rule.** Nothing on screen is smaller than 0.7rem, and multi-line notes are at least 0.8rem. The one exception is the grid's × and – marks: they are decorative (hidden from assistive tech; every state also has its own fill, hatch or ring and a spoken name), and they are sized from their cell so they can never outgrow it, which on the narrowest phones or at large text takes them under the floor.

**The One Ramp Rule.** A size that isn't on the ramp above is a mistake, not a nuance: round it to the nearest step.

## Layout

A single centred column (max 1080px on the dashboard and landing, 640–900px on inner pages) with a 1.5rem gutter. The dashboard is two columns above 54em (864px at default text size, so large text gets one column sooner), the check-in card beside a grid panel that stays in view as the card scrolls. Below that it is one column with a compact copy of the grid under the header, so the mark is on the first screen. Spacing steps in about 0.25rem increments (0.5, 0.75, 1.25, 1.5, 2.5rem): groups sit tight, panels breathe. Touch targets are 44px throughout, with one exception: the grid's day cells (15 across, about 18px on a phone), which are the product's picture first and a way in second. Every day is also reachable at full size from right under the grid, through Browse past days and the detail's Previous/Next. Text reflows cleanly at 320px and at 200% zoom.

## Elevation & Depth

The system is flat paper with printed marks. It has no blur shadows and no glass. Depth has one expression: a hard offset of pigment behind an element, as if a second riso pass landed a few pixels off-register. The offset is a state signal, not an ambient lift.

### Shadow Vocabulary
- **Misregistration, state** (`box-shadow: 4px 5px 0 var(--cobalt)`): a completed check-in card. Coral for the reset banner, marigold for the finished panel. Smaller for a chosen option: `3px 4px 0` on a selected medium or policy card, `2px 3px 0` on a selected chip.
- **Misregistration, hover** (`box-shadow: 4px 6px 0 var(--coral)`, with `translateY(-2px)`): buttons, on hover-capable pointers only.
- **Stamp** (`box-shadow: 1px 1.5px 0 color-mix(in srgb, var(--ink) 22%, transparent)`): grid stamps and token chips, the ink edge of a rubber stamp.
- **Moment** (`box-shadow: 6px 8px 0 var(--cobalt)`): the celebration card.

### Named Rules
**The Off-Register Rule.** Depth is always a zero-blur pigment offset tied to a state (done, ended, finished, hovered). A soft or ambient shadow is outside this world.

## Shapes

One radius scale: panels 14px, fields, rule rows and thumbnails 10px, stamps, checkboxes, token pips and keycaps 4px (2px in the compact grid and for confetti), and pills 999px for buttons and chips. Borders are 1.5px everywhere: solid for structure, dashed for "still to do" (evidence boxes and help dividers) and for things you can edit inline, dotted for days to come. The heavier lines are the grid's own: today's ring (2.5px coral, on the grid and its legend swatch), which has to read at a glance among 75 cells, and the ring round the day opened in the detail (2.5px ink); once today is made its cobalt stamp keeps a 2px coral outline. Focus (3px cobalt) outranks all of them. Sizes attached to a numeral or keycap (the day denominator, the streak unit, kbd) follow their numeral in em, clamped to the ramp's bounds and the 11px floor. Stamps rotate by a deterministic −3.5° to 3.5°.

## Components

### Buttons
- **Shape:** full pill (999px), 44px minimum height.
- **Primary:** ink fill with paper text, Space Mono uppercase 0.875rem with 0.04em tracking (0.85rem 1.4rem padding). Labels wrap inside the button at large text rather than widening the page.
- **Disabled:** dimmed by colour (the ink mixed 42% into the paper), not opacity, so a focus ring on it keeps full strength; no hover offset. A control that turns off under the keyboard (Add link once the field clears, Upload while compressing, Previous/Next at either end) uses `aria-disabled` so it keeps focus; `disabled` is only for controls that were never reachable.
- **Hover / Focus:** hover lifts 2px with a coral misregistration offset (hover devices only). Focus is a 3px cobalt outline with a 2px offset.
- **Ghost:** transparent with an ink border; its hover offset is cobalt.
- **Danger:** a coral-ink fill with white text (dark: paper text), used only for the two acts that can't be taken back: deleting the account, and confirming the end of a running challenge.

### Chips
- **Style:** a paper pill with a field-border edge, Space Mono 0.8rem, 44px tall.
- **State:** selected is a cobalt edge on a 14% cobalt tint, a 2px 3px cobalt state offset and a bold label, exposed as `aria-pressed`. The offset and weight carry the choice without hue.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** paper-2 on the paper page.
- **Shadow Strategy:** none at rest; a misregistration offset only in a state (see Elevation).
- **Border:** 1.5px line.
- **Internal Padding:** 1.25–1.75rem.

### Inputs / Fields
- **Style:** a paper fill with a 1.5px field-border edge, 10px radius, 44px minimum, 16px text (so iOS doesn't zoom).
- **Focus:** the edge turns cobalt and the global focus ring shows.
- **Placeholder:** muted, at least 4.5:1.

### Navigation
- **Style:** the wordmark on the left in display 800. Links on the right in Space Mono uppercase 0.8rem, padded to 44px, turning coral-ink on hover. The row wraps under the wordmark when it can't fit.

### The Grid (signature)
- **Structure:** 15 columns by 5 rows for 75 days (more rows when extended), with a 6px gap (4px on phones).
- **States:** made is a rotated cobalt stamp; skipped is a rotated marigold stamp with a dash; missed is a neutral hatch with a × mark; today is a coral ring that pulses three times; to come is a dotted outline.
- **Behaviour:** one Tab stop with arrow keys; settled days open their log and artifacts; one summary sentence for screen readers.

### The Check-in Card (signature)
- **Structure:** the date as the heading, a meta line with how many rules are done and when the day closes, then one row per rule.
- **Rules:** plain rules are full-width toggles. Evidence rules ("Log the day", "Capture an artifact") hold their own field and tick themselves when the evidence exists (dashed box until then).
- **Done:** a −3° cobalt "Done" stamp and a cobalt misregistration offset.

## Do's and Don'ts

### Do:
- **Do** keep every pigment tied to its day state (cobalt made, marigold skipped, coral today and stakes).
- **Do** use the `-ink` variant whenever a pigment carries text.
- **Do** express depth only as a zero-blur pigment offset tied to a state.
- **Do** keep controls at 44px and fields on the shared `field-input` / `chip` primitives.
- **Do** state a miss in plain ink tone, paired with the person's own "why I started".

### Don't:
- **Don't** put a small label above a heading.
- **Don't** use blur shadows, glass or gradients as decoration.
- **Don't** colour a missed day coral or red.
- **Don't** stand Unicode glyphs or emoji in for icons. The icon set is drawn at 1.75 stroke on a 24px grid.
- **Don't** show a statistic the app didn't record (for example minutes spent).
