'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/components/AppProvider'
import { StreakHeader } from '@/components/StreakHeader'
import { Grid, GridLegend } from '@/components/Grid'
import { CHECK_IN_ID, DayCard, isTyping } from '@/components/DayCard'
import { DAY_DETAIL_ID, DayDetail } from '@/components/DayDetail'
import { Celebration } from '@/components/Celebration'
import { MissPolicyBanner } from '@/components/MissPolicyBanner'
import { PastAttempts } from '@/components/PastAttempts'
import { hasLog, milestoneAt } from '@/lib/challengeSession'
import { finishLine, longDay, milestoneCopy } from '@/lib/format'

/** Where focus can land when the card isn't there (see dismissNotice). */
const FINISH_ID = 'finish'
const GRID_ID = 'grid'

export default function Dashboard() {
  const {
    loading,
    user,
    challenge,
    dayData,
    derived,
    phase,
    resetMessage,
    missedDay,
    creativeToday,
    dayCloses,
    stakes,
    banner,
    dismissBanner,
    confirmReset,
    enterMaintenance,
  } = useApp()
  const router = useRouter()
  const [celebrate, setCelebrate] = useState(false)
  const [celebratedDay, setCelebratedDay] = useState(0)
  const [milestone, setMilestone] = useState<{ title: string; sub: string } | null>(null)
  const [openDay, setOpenDay] = useState<number | null>(null)
  const [refocus, setRefocus] = useState<{ day: number | null; key: number }>({ day: null, key: 0 })
  // Each day celebrates once per visit: un-ticking and re-ticking a rule
  // shouldn't replay the moment.
  const celebrated = useRef(new Set<number>())
  // Day 75's moment ends on the way forward: the finish panel, with the
  // recap, which sits above the card (off-screen on a phone).
  const finalPending = useRef(false)
  // Stable identity: Celebration keys its dismiss timer off this callback.
  const endCelebration = useCallback(() => {
    setCelebrate(false)
    if (!finalPending.current) return
    finalPending.current = false
    requestAnimationFrame(() => {
      // Not while the person is typing (the log can be the last rule, and
      // they may keep writing after the moment): focus stays with them.
      if (isTyping(document.activeElement)) return
      const panel = document.getElementById(FINISH_ID)
      panel?.scrollIntoView({ block: 'center' })
      panel?.focus({ preventScroll: true })
    })
  }, [])

  useEffect(() => {
    if (loading) return
    if (!user) router.replace('/signin')
    else if (!challenge) router.replace('/setup')
  }, [loading, user, challenge, router])

  const totalDays = derived.totalDays
  const handleComplete = useCallback(
    (dayIndex: number) => {
      if (celebrated.current.has(dayIndex)) return
      celebrated.current.add(dayIndex)
      const m = milestoneAt(dayIndex, totalDays)
      finalPending.current = m === 'final'
      setMilestone(m ? milestoneCopy(m, dayIndex, totalDays) : null)
      setCelebratedDay(dayIndex)
      setCelebrate(true)
    },
    [totalDays],
  )

  const { currentIndex, checkInOpen } = derived

  // The day rolled over with the page open: the card remounts under
  // whoever was using it. Put them on the news (a notice) or the new card,
  // never the page.
  const lastIndex = useRef(currentIndex)
  useEffect(() => {
    const was = lastIndex.current
    lastIndex.current = currentIndex
    if (was === 0 || was === currentIndex) return
    const lost = !document.activeElement || document.activeElement === document.body
    if (!lost) return
    requestAnimationFrame(() => {
      const to = document.getElementById('notice') ?? document.getElementById(CHECK_IN_ID)
      to?.focus({ preventScroll: true })
    })
  }, [currentIndex])
  // Stable across autosaves (the day states and today don't change while
  // someone types), so the memoized grid skips those renders.
  const onOpenDay = useCallback(
    (index: number) => {
      if (index === currentIndex && checkInOpen) {
        document.getElementById(CHECK_IN_ID)?.focus()
        document.getElementById(CHECK_IN_ID)?.scrollIntoView({ block: 'start' })
        return
      }
      setOpenDay((open) => (open === index ? null : index))
    },
    [currentIndex, checkInOpen],
  )

  if (loading || !user || !challenge) {
    return (
      <main className="dash">
        <p className="status-line" role="status">
          Loading your grid…
        </p>
      </main>
    )
  }

  const gridDays = derived.days
  const finish = finishLine(derived.tally, totalDays)
  const opened = openDay ? gridDays.find((d) => d.index === openDay) : undefined
  // Past days you can browse: everything settled before today.
  // Today (made or not) is the check-in card's, not the browser's.
  const pastDays = gridDays
    .filter((d) => d.state !== 'future' && d.state !== 'today' && !(checkInOpen && d.index === currentIndex))
    .map((d) => d.index)
  const afterDays =
    phase === 'maintenance'
      ? Object.entries(dayData.logs)
          .map(([i, l]) => ({ day: Number(i), text: l.text.trim() }))
          // Today's log is in the card above; the list is the days before it.
          .filter((l) => l.day > totalDays && l.day !== currentIndex && hasLog(dayData, l.day))
          .sort((a, b) => b.day - a.day)
      : []

  function closeDay() {
    const from = openDay
    setOpenDay(null)
    setRefocus((r) => ({ day: from, key: r.key + 1 }))
  }

  function stepDay(delta: -1 | 1) {
    if (openDay == null) return
    const at = pastDays.indexOf(openDay)
    const next = pastDays[at + delta]
    if (next != null) setOpenDay(next)
  }

  function confirmResetAndFocus() {
    // An open day belonged to the attempt that just ended.
    setOpenDay(null)
    confirmReset()
    // The banner and panel go; Day 1's check-in takes their place.
    requestAnimationFrame(() => document.getElementById(CHECK_IN_ID)?.focus({ preventScroll: true }))
  }

  function startMaintenance() {
    setOpenDay(null)
    enterMaintenance()
    // The next-step panel goes; today's maintenance card takes its place,
    // and landing on it says what the new mode is.
    requestAnimationFrame(() => document.getElementById(CHECK_IN_ID)?.focus({ preventScroll: true }))
  }

  function startNewRound() {
    // Nothing closes yet: the round ends when the next one starts in setup.
    router.push('/setup')
  }

  function dismissNotice() {
    dismissBanner()
    // The banner and its button are gone: land on the check-in, not the
    // page, or (past the last day, with no check-in) the finish or the grid.
    const to = [CHECK_IN_ID, FINISH_ID, GRID_ID].map((id) => document.getElementById(id)).find(Boolean)
    to?.focus({ preventScroll: true })
  }

  const heading =
    phase === 'reset-pending'
      ? `Ended on Day ${missedDay}`
      : phase === 'finished' && !checkInOpen
        ? // The finish panel's own heading says the finish; the page's names the state.
          'Challenge finished'
        : phase === 'maintenance'
        ? `Maintenance, day ${currentIndex}`
        : phase === 'prestart'
          ? 'Your challenge has not started yet'
          : `Day ${Math.min(currentIndex, totalDays)} of ${totalDays}`

  return (
    <>
      {checkInOpen || phase === 'maintenance' ? (
        <a href={`#${CHECK_IN_ID}`} className="skip-link">
          Skip to today’s check-in
        </a>
      ) : null}
      <main className="dash">
        <nav className="dash-nav" aria-label="Main">
          <Link href="/" className="wordmark font-display brand">
            75 Create
          </Link>
          <div className="nav-links font-mono">
            <Link href="/recap">Recap</Link>
            <Link href="/dashboard/share">Share</Link>
            <Link href="/settings">Settings</Link>
          </div>
        </nav>

        <h1 className="sr-only">{heading}</h1>

        <StreakHeader
          dayIndex={currentIndex}
          current={derived.streak.current}
          longest={derived.streak.longest}
          totalDays={totalDays}
          phase={phase}
          stakes={stakes}
          missedDay={missedDay}
          made={derived.tally.made}
        />

        {/* On a phone the full grid sits below the check-in: show the mark
            itself up top, where the app opens, as a way down to the grid. */}
        <a href={`#${GRID_ID}`} className="mini-grid" aria-label="Jump to the grid">
          <Grid
            days={gridDays}
            compact
            today={checkInOpen ? currentIndex : null}
            endedOn={phase === 'reset-pending' ? missedDay : null}
          />
        </a>

        {phase === 'reset-pending' && resetMessage && (
          <div className="banner-slot">
            <MissPolicyBanner
              banner={{ kind: 'reset', message: resetMessage }}
              whyNote={challenge.whyNote}
              onConfirmReset={confirmResetAndFocus}
              onDismiss={dismissBanner}
            />
          </div>
        )}

        {banner && phase !== 'reset-pending' && (
          <div className="banner-slot">
            <MissPolicyBanner
              banner={banner}
              whyNote={challenge.whyNote}
              onConfirmReset={confirmReset}
              onDismiss={dismissNotice}
            />
          </div>
        )}

        {phase === 'finished' && (
          <section id={FINISH_ID} className="finish panel" aria-labelledby="finish-title" tabIndex={-1}>
            <div>
              <h2 id="finish-title" className="font-display finish-h2">
                {finish.title}
              </h2>
              <p className="finish-sub">
                {finish.detail} Your recap has the stats, the timeline and a certificate.
              </p>
            </div>
            <Link href="/recap" className="btn">
              See your recap
            </Link>
          </section>
        )}

        <div className="main-cols">
          <div className="col-card">
            {phase === 'prestart' && (
              <section className="panel state-panel" aria-labelledby="pre-title">
                <h2 id="pre-title" className="font-display">
                  Day 1 is {longDay(challenge.startDate)}.
                </h2>
                <p>The grid is set. Come back then for your first check-in. Changed your mind before it starts? Ending it in Settings takes you back to setup, at no cost.</p>
              </section>
            )}
            {(checkInOpen || phase === 'maintenance') && (
              <DayCard
                key={currentIndex}
                challenge={challenge}
                dayIndex={currentIndex}
                dayData={dayData}
                creativeToday={creativeToday}
                dayCloses={dayCloses}
                stakes={phase === 'maintenance' ? null : stakes}
                maintenance={phase === 'maintenance'}
                onComplete={handleComplete}
              />
            )}
            {phase === 'finished' && !checkInOpen && (
              // Past the last day, the dashboard is still where they open the
              // app: the next step is offered here, not only on the recap.
              <section className="panel state-panel" aria-labelledby="next-title">
                <h2 id="next-title" className="font-display">
                  Keep the habit, or run it back.
                </h2>
                <p>
                  Maintenance mode keeps a daily log and artifact with no rules and no resets.
                  Or start a fresh 75, with new rules if you like.
                </p>
                <div className="next-actions">
                  <button className="btn btn-ghost" onClick={startMaintenance}>
                    Maintenance mode
                  </button>
                  {/* The recap stays the one primary: this is the other way on. */}
                  <button className="btn btn-ghost" onClick={startNewRound}>
                    Start a new round
                  </button>
                </div>
              </section>
            )}
            {phase === 'reset-pending' && (
              <section className="panel state-panel" aria-labelledby="ended-title">
                <h2 id="ended-title" className="font-display">
                  Day 1 starts when you do.
                </h2>
                <p>This attempt’s grid and every log you wrote are kept, in your past attempts.</p>
              </section>
            )}
          </div>

          <div className="col-grid">
            <section id={GRID_ID} tabIndex={-1} className="grid-panel panel" aria-labelledby="grid-title">
              <div className="grid-caption">
                <h2 id="grid-title" className="grid-title font-display">
                  The grid
                </h2>
                <GridLegend days={gridDays} today={checkInOpen} />
              </div>
              <Grid
                days={gridDays}
                onOpenDay={onOpenDay}
                selected={openDay}
                detailId={DAY_DETAIL_ID}
                refocus={refocus.day}
                focusKey={refocus.key}
                endedOn={phase === 'reset-pending' ? missedDay : null}
                today={checkInOpen ? currentIndex : null}
              />
              {opened ? (
                <DayDetail
                  day={opened}
                  dayData={dayData}
                  onClose={closeDay}
                  onStep={stepDay}
                  missPolicy={challenge.missPolicy}
                  hasPrev={pastDays.indexOf(opened.index) > 0}
                  hasNext={pastDays.indexOf(opened.index) < pastDays.length - 1}
                />
              ) : pastDays.length > 0 ? (
                <div className="grid-foot">
                  <p className="grid-hint">Choose a day to see what you made.</p>
                  <button
                    type="button"
                    className="btn btn-ghost small"
                    onClick={() => setOpenDay(pastDays[pastDays.length - 1])}
                  >
                    Browse past days
                  </button>
                </div>
              ) : null}
              {phase === 'maintenance' && (
                // Maintenance is optional; a fresh 75 is always one step away.
                <div className="round-foot">
                  <p className="grid-hint">Ready for another 75?</p>
                  <button type="button" className="btn btn-ghost small" onClick={startNewRound}>
                    Start a new round
                  </button>
                </div>
              )}
              {afterDays.length > 0 && (
                <section className="after" aria-labelledby="after-title">
                  <h3 id="after-title" className="font-display after-h3">
                    Since Day {totalDays}
                  </h3>
                  <ol className="after-list">
                    {afterDays.slice(0, 7).map((l) => (
                      <li key={l.day}>
                        <span className="after-day font-mono">Day {l.day}</span>
                        <span>{l.text}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </section>
          </div>
        </div>

        <PastAttempts />

        <Celebration
          show={celebrate}
          milestone={milestone}
          dayIndex={celebratedDay}
          days={derived.days}
          onDone={endCelebration}
        />

        <style jsx>{`
          .dash {
            max-width: 1080px;
            padding-top: 1rem;
          }
          .dash-nav {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0 1.75rem;
          }
          .brand {
            font-size: 1.25rem;
            text-decoration: none;
          }
          .nav-links {
            display: flex;
            flex-wrap: wrap;
            min-width: 0;
            justify-content: flex-end;
            gap: 0.1rem;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          .nav-links :global(a) {
            color: var(--ink-soft);
            text-decoration: none;
            /* Padded out to a 44px thumb target rather than a 20px text line. */
            display: inline-flex;
            align-items: center;
            min-height: 44px;
            padding: 0 0.55rem;
            border-radius: 10px;
          }
          .nav-links :global(a:hover) {
            color: var(--coral-ink);
          }
          @media (max-width: 360px) {
            /* Wordmark and all three links on one line at 320px. */
            .nav-links {
              letter-spacing: 0.02em;
            }
            .nav-links :global(a) {
              padding: 0 0.4rem;
            }
          }
          .banner-slot {
            margin-top: 1.5rem;
          }
          .finish:focus:not(:focus-visible) {
            outline: none;
          }
          .finish {
            margin-top: 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1.25rem;
            padding: 1.5rem;
            flex-wrap: wrap;
            box-shadow: 4px 5px 0 var(--marigold);
          }
          .finish-h2 {
            font-size: 2rem;
            margin: 0;
          }
          .finish-sub {
            margin: 0.5rem 0 0;
            max-width: 60ch;
            color: var(--ink-soft);
            line-height: 1.5;
          }
          .main-cols {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 1.5rem;
            margin-top: 2rem;
            /* Columns stretch to the row, so the grid panel has room to
               stay in view beside a long check-in card (sticky below). */
          }
          .grid-panel {
            padding: 1.25rem;
            position: sticky;
            top: 1rem;
          }
          .grid-caption {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 0.9rem;
            gap: 0.5rem 1rem;
            flex-wrap: wrap;
          }
          .grid-title {
            font-size: 1.25rem;
            margin: 0;
          }
          .grid-foot {
            margin-top: 0.9rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem 1rem;
            flex-wrap: wrap;
          }
          .grid-hint {
            margin: 0;
            font-size: 0.875rem;
            color: var(--muted);
          }
          .grid-foot .small {
            min-height: 44px;
            padding: 0.5rem 1rem;
            font-size: 0.75rem;
          }
          .mini-grid {
            display: none;
          }
          .after {
            margin-top: 1.25rem;
            padding-top: 1rem;
            border-top: 1.5px dashed var(--line);
          }
          .after-h3 {
            font-size: 1.25rem;
            margin: 0 0 0.6rem;
          }
          .after-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            font-size: 0.875rem;
            line-height: 1.45;
          }
          .after-list li {
            display: grid;
            grid-template-columns: 4.5rem minmax(0, 1fr);
            gap: 0.6rem;
            overflow-wrap: anywhere;
          }
          @media (max-width: 30em) {
            /* A phone, or large text: the day sits above its log. */
            .after-list li {
              grid-template-columns: minmax(0, 1fr);
              gap: 0.15rem;
            }
          }
          .after-day {
            color: var(--muted);
            font-size: 0.8rem;
            padding-top: 0.1rem;
          }
          .state-panel {
            padding: min(1.75rem, 5vw);
          }
          .round-foot {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 0.6rem;
            margin-top: 1.25rem;
            padding-top: 1rem;
            border-top: 1.5px dashed var(--line);
          }
          .next-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.6rem;
            margin-top: 1.1rem;
          }
          .state-panel h2 {
            font-size: 1.5rem;
            margin: 0 0 0.6rem;
            text-wrap: balance;
          }
          .state-panel p {
            color: var(--ink-soft);
            margin: 0;
            line-height: 1.5;
          }
          @media (max-width: 54em) {
            /* In em, so large text also gets the single column. */
            .mini-grid {
              display: block;
              margin-top: 1rem;
              /* The mark, not a second full grid: small enough that the
                 check-in starts on the first screen. */
              max-width: min(15rem, 100%);
              border-radius: 10px;
            }
            .main-cols {
              grid-template-columns: minmax(0, 1fr);
              margin-top: 1.25rem;
            }
            .grid-panel {
              position: static;
            }
          }

        `}</style>
      </main>
    </>
  )
}
