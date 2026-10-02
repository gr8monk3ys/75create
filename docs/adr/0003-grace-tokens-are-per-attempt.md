# Grace skip tokens are per attempt

The MVP spec (§4.2) called them "3 lifetime skip tokens". Under Grace a reset
only happens once all three are spent, so carrying the count into the next
attempt would make every restart Classic from Day 1 — the policy the person
deliberately didn't choose. A restart is a fresh attempt at the same
challenge, so it gets three fresh tokens. The setup copy says "per attempt"
and the session recounts tokens from the attempt's own skips.
