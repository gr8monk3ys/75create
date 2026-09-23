import Link from 'next/link'
import { Grid } from '@/components/Grid'
import { DEFAULT_RULES, Day, TOTAL_DAYS } from '@/lib/types'

// A deterministic mid-challenge sample so the landing shows the brand in motion.
function sampleDays(): Day[] {
  const days: Day[] = []
  const today = 34
  for (let i = 1; i <= TOTAL_DAYS; i++) {
    let state: Day['state']
    if (i === today) state = 'today'
    else if (i > today) state = 'future'
    else if (i === 12 || i === 27) state = 'skipped'
    else if (i === 19) state = 'missed'
    else state = 'complete'
    days.push({ challengeId: 'demo', index: i, state, completedAt: null })
  }
  return days
}

const POLICIES = [
  {
    name: 'Classic',
    line: 'Miss a day, restart at Day 1. The iconic, unforgiving version.',
  },
  {
    name: 'Grace',
    line: 'Three lifetime skip tokens. A fourth miss resets you.',
  },
  {
    name: 'Extend',
    line: 'A missed day adds a day to the end. The streak resets; the work goes on.',
  },
]

export default function Home() {
  const days = sampleDays()
  return (
    <>
      <header className="site-head">
        <nav className="nav" aria-label="Main">
          <span className="wordmark font-display">75 Create</span>
          <Link href="/signin" className="btn btn-ghost">
            Sign in
          </Link>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <h1 className="font-display hero-h1">
              75 marks.
              <br />
              One a day.
            </h1>
            <p className="lede">
              A 75-day creative challenge. Pick your craft, do five things every day for 75 days, and watch the
              grid fill in. Miss nothing and it&apos;s a wall of pigment. Finish and
              you walk away with 75 days of proof you made something.
            </p>
            <div className="cta-row">
              <Link href="/signin" className="btn">
                Start my 75
              </Link>
              <span className="free-note font-mono">
                Free. No ads. Private by default.
              </span>
            </div>
          </div>

          <div className="hero-grid panel">
            <div className="grid-caption">
              <span className="grid-sample font-mono">Example grid · day 34 of 75</span>
              <span className="grid-legend font-mono" aria-hidden>
                <span>
                  <i className="sw sw-c" /> made
                </span>
                <span>
                  <i className="sw sw-s" /> skipped
                </span>
                <span>
                  <i className="sw sw-m" /> missed
                </span>
                <span>
                  <i className="sw sw-t" /> today
                </span>
                <span>
                  <i className="sw sw-f" /> to come
                </span>
              </span>
            </div>
            <Grid days={days} />
          </div>
        </section>

        <section className="rules">
          <h2 className="font-display sec-h2">Same five things, every day.</h2>
          <ol className="rule-list">
            {DEFAULT_RULES.map((r, i) => (
              <li key={r.id} className="rule">
                <span className="rule-num font-mono">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display rule-h3">{r.name}</h3>
                  <p>{r.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="custom-note">
            Not your medium? Rename them, drop the ones that don&apos;t fit, add your
            own — 3 to 7 rules. You lock the rules in before Day 1.
          </p>
        </section>

        <section className="policies">
          <h2 className="font-display sec-h2">Choose what a miss costs.</h2>
          <p className="policy-intro">
            The full reset is iconic — and the top reason people quit for good. You
            pick the rule up front, and it locks. No softening it at 2 a.m. on Day 40.
          </p>
          <div className="policy-grid">
            {POLICIES.map((p) => (
              <div key={p.name} className="policy panel">
                <h3 className="font-display rule-h3">{p.name}</h3>
                <p>{p.line}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="closer">
          <h2 className="font-display sec-h2">Start the grid.</h2>
          <Link href="/signin" className="btn">
            Start my 75
          </Link>
        </section>

      </main>
      <footer className="foot site-foot font-mono">
        75 Create · a free tracker for creative discipline · honor system, no
        verification
      </footer>
    </>
  )
}
