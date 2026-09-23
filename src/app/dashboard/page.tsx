'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/components/AppProvider'
import { StreakHeader } from '@/components/StreakHeader'
import { Grid } from '@/components/Grid'
import { DayCard } from '@/components/DayCard'
import { DayDetail } from '@/components/DayDetail'
import { Celebration } from '@/components/Celebration'
import { MissPolicyBanner } from '@/components/MissPolicyBanner'
import { PastAttempts } from '@/components/PastAttempts'
import { longDay } from '@/lib/format'

const MILESTONES = new Set([7, 25, 50, 75])

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
    repo,
  } = useApp()
  const router = useRouter()
  const [celebrate, setCelebrate] = useState(false)
  const [celebratedDay, setCelebratedDay] = useState(0)
  const [milestone, setMilestone] = useState<number | null>(null)
  const [openDay, setOpenDay] = useState<number | null>(null)
  // Each day celebrates once per visit: un-ticking and re-ticking a rule
  // shouldn't replay the moment.
  const celebrated = useRef(new Set<number>())
  // Stable identity: Celebration keys its dismiss timer off this callback.
  const endCelebration = useCallback(() => setCelebrate(false), [])

  useEffect(() => {
    if (loading) return
    if (!user) router.replace('/signin')
    else if (!challenge) router.replace('/setup')
  }, [loading, user, challenge, router])

  const handleComplete = useCallback((dayIndex: number) => {
    if (celebrated.current.has(dayIndex)) return
    celebrated.current.add(dayIndex)
    setMilestone(MILESTONES.has(dayIndex) ? dayIndex : null)
    setCelebratedDay(dayIndex)
    setCelebrate(true)
  }, [])

  if (loading || !user || !challenge) {
    return (
      <main className="dash">
        <p className="loading font-mono" role="status">
          Loading your grid…
        </p>
        <style jsx>{`
          .loading {
            color: var(--muted);
            padding: 4rem 0;
          }
        `}</style>
      </main>
    )
  }

  const { currentIndex, totalDays } = derived
  const checkInOpen =
    phase === 'active' || (phase === 'finished' && currentIndex <= totalDays)
  // With the attempt ended there is no today to check in: don't draw one.
  const gridDays =
    phase === 'reset-pending'
      ? derived.days.map((d) => (d.state === 'today' ? { ...d, state: 'future' as const } : d))
      : derived.days
  const opened = openDay ? gridDays.find((d) => d.index === openDay) : undefined

  function onOpenDay(index: number) {
    if (index === currentIndex && checkInOpen) {
      document.getElementById('check-in')?.focus()
      document.getElementById('check-in')?.scrollIntoView({ block: 'start' })
      return
    }
    setOpenDay(openDay === index ? null : index)
  }

  const heading =
    phase === 'reset-pending'
      ? 'Your attempt has ended'
      : phase === 'maintenance'
        ? `Maintenance, day ${currentIndex}`
        : phase === 'prestart'
          ? 'Your challenge has not started yet'
          : `Day ${Math.min(currentIndex, totalDays)} of ${totalDays}`

  return (
    <>
      {checkInOpen || phase === 'maintenance' ? (
        <a href="#check-in" className="skip-link">
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
        />

        {phase === 'reset-pending' && resetMessage && (
          <div className="banner-slot">
            <MissPolicyBanner
              banner={{ kind: 'reset', message: resetMessage }}
              whyNote={challenge.whyNote}
              onConfirmReset={confirmReset}
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
              onDismiss={dismissBanner}
            />
          </div>
        )}

        {phase === 'finished' && (
          <section className="finish panel" aria-labelledby="finish-title">
            <div>
              <h2 id="finish-title" className="font-display finish-h2">
                {derived.completedCount >= totalDays ? `${totalDays} days, done.` : 'The window has closed.'}
              </h2>
              <p className="finish-sub">
                {derived.completedCount} days made. Your recap has the stats, the timeline and a
                certificate.
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
              <section className="panel prestart" aria-labelledby="pre-title">
                <h2 id="pre-title" className="font-display">
                  Day 1 is {longDay(challenge.startDate)}.
                </h2>
                <p>The grid is set and your rules are locked. Come back then for your first check-in.</p>
              </section>
            )}
            {checkInOpen && (
              <DayCard
                key={currentIndex}
                repo={repo}
                challenge={challenge}
                dayIndex={currentIndex}
                dayData={dayData}
                creativeToday={creativeToday}
                dayCloses={dayCloses}
                stakes={stakes}
                onComplete={handleComplete}
              />
            )}
            {phase === 'maintenance' && (
              <DayCard
                key={currentIndex}
                repo={repo}
                challenge={challenge}
                dayIndex={currentIndex}
                dayData={dayData}
                creativeToday={creativeToday}
                dayCloses={dayCloses}
                stakes={null}
                maintenance
                onComplete={handleComplete}
              />
            )}
            {phase === 'reset-pending' && (
              <section className="panel prestart" aria-labelledby="ended-title">
                <h2 id="ended-title" className="font-display">
                  Day 1 starts when you do.
                </h2>
                <p>
                  Starting again keeps your {challenge.rules.length} rules and your reason for
                  starting. This attempt’s grid and logs move to past attempts below.
                </p>
              </section>
            )}
          </div>

          <div className="col-grid">
            <section className="grid-panel panel" aria-labelledby="grid-title">
              <div className="grid-caption">
                <h2 id="grid-title" className="grid-title font-display">
                  The grid
                </h2>
                <span className="grid-legend font-mono" aria-hidden>
                  <span>
                    <i className="sw sw-c" /> made
                  </span>
                  <span>
                    <i className="sw sw-t" /> today
                  </span>
                  <span>
                    <i className="sw sw-s" /> skipped
                  </span>
                  <span>
                    <i className="sw sw-m" /> missed
                  </span>
                  <span>
                    <i className="sw sw-f" /> to come
                  </span>
                </span>
              </div>
              <Grid days={gridDays} onOpenDay={onOpenDay} selected={openDay} />
              {opened ? (
                <DayDetail day={opened} dayData={dayData} repo={repo} onClose={() => setOpenDay(null)} />
              ) : (
                <p className="grid-hint">Tap a past day to see what you made.</p>
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
            gap: 0.1rem;
            font-size: 0.78rem;
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
            border-radius: 8px;
          }
          .nav-links :global(a:hover) {
            color: var(--coral-ink);
          }
          .banner-slot {
            margin-top: 1.5rem;
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
            font-size: 1.8rem;
            margin: 0;
          }
          .finish-sub {
            margin: 0.5rem 0 0;
            color: var(--ink-soft);
            line-height: 1.5;
          }
          .main-cols {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 1.5rem;
            margin-top: 2rem;
            align-items: start;
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
            font-size: 1.1rem;
            margin: 0;
          }
          .grid-hint {
            margin: 0.9rem 0 0;
            font-size: 0.85rem;
            color: var(--muted);
          }
          .prestart {
            padding: 1.75rem;
          }
          .prestart h2 {
            font-size: 1.5rem;
            margin: 0 0 0.6rem;
            text-wrap: balance;
          }
          .prestart p {
            color: var(--ink-soft);
            margin: 0;
            line-height: 1.5;
          }
          @media (max-width: 860px) {
            .main-cols {
              grid-template-columns: minmax(0, 1fr);
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
