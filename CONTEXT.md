# 75 Create

A 75-day creative discipline challenge in the 75 Hard / 75 Fluent format: a person commits to a set of daily creative rules for 75 days, checks in every day, and ends with 75 days of documented work.

## Language

### The challenge

**Challenge**:
One run of the 75-day commitment: a medium, a locked rule set, a miss policy and a start date.
_Avoid_: Program, plan, streak (a streak is a count within a challenge)

**Attempt**:
A challenge considered as one try; a reset archives the attempt and starts a new one with the same rules.
_Avoid_: Run, round (except "new round", below)

**Rule**:
One daily task the person commits to, 3 to 7 per challenge, locked once the challenge starts. A rule is required or optional.
_Avoid_: Task (in copy, "task" is fine for the checkbox; the domain term is rule), habit, goal

**Why note**:
The person's own reason for starting, written at setup and shown back to them when a day is missed.

**Medium**:
The kind of creative work (writing, drawing, music, …). It tailors wording only; it does not change rules.

### Days

**Creative day**:
The calendar date a moment belongs to for the challenge: the person's local date with the clock shifted back by the late-night buffer, so 1:30am still counts as the previous day.
_Avoid_: Calendar day, today (when the buffer matters)

**Late-night buffer**:
The hours after midnight that still belong to the previous creative day (default 3).

**Day index**:
The 1-based position of a creative day within a challenge; Day 1 is the start date.

**Check-in**:
Recording a creative day: checking rules, writing the log, capturing an artifact.

**Complete day**:
A day on which every required rule is checked (every rule, if none is required).

**Log**:
A short note (up to 500 characters) about what was made or learned on a day.

**Artifact**:
Evidence of a day's work: an uploaded image or a link. Private by default.

**Grid**:
The 75-cell (or longer, when extended) map of every day's state. The product's signature image.

### Misses

**Missed day**:
A day before today that is neither complete nor skipped.

**Miss policy**:
What a missed day costs, chosen at setup and locked: Classic, Grace or Extend.

**Classic**:
Any missed day ends the attempt.

**Grace**:
Three skip tokens for the life of the challenge; a miss with no token left ends the attempt.

**Skip token**:
Covers one missed day under Grace, turning it into a skipped day.

**Extend**:
Each missed day adds one day to the end of the challenge; the attempt continues.

**Rollover**:
Applying miss consequences to days that have newly become missed, oldest first.

**Reset**:
Ending an attempt after a Classic miss (or a Grace miss with no tokens left). It waits for the person to confirm, archives the attempt and restarts at Day 1 on the current creative day.
_Avoid_: Fail, restart (in code)

### After Day 75

**Finished**:
A challenge whose last day is complete, or whose window has closed.

**Maintenance**:
The optional mode after finishing: a daily log and artifact with no rules and no misses.

**New round**:
Closing a finished challenge so a fresh one can be set up.

**Recap**:
The end-of-challenge summary: stats, the grid, the artifact timeline and the certificate.
