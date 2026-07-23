'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/components/AppProvider'
import { StreakHeader } from '@/components/StreakHeader'
import { Grid } from '@/components/Grid'
import { DayCard } from '@/components/DayCard'
import { Celebration } from '@/components/Celebration'
import { MissPolicyBanner } from '@/components/MissPolicyBanner'
import { PastAttempts } from '@/components/PastAttempts'

const MILESTONES = new Set([7, 25, 50, 75])

export default function Dashboard() {
  const {
    loading,
    user,
    challenge,
    dayData,
    derived,
    banner,
    dismissBanner,
    confirmReset,
    refresh,
    repo,
  } = useApp()
  const router = useRouter()
  const [celebrate, setCelebrate] = useState(false)
  const [milestone, setMilestone] = useState<number | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) router.replace('/signin')
    else if (!challenge) router.replace('/setup')
  }, [loading, user, challenge, router])

  if (loading || !user || !challenge) {
    return (
      <main className="dash">
        <p className="loading font-mono">Loading your grid…</p>
      </main>
    )
  }

  const total = derived.days.length
  const { currentIndex } = derived
  const preStart = currentIndex === 0
  const withinWindow = currentIndex >= 1 && currentIndex <= total
  const finalComplete = derived.days[total - 1]?.state === 'complete'
  const elapsed = currentIndex > total

  function handleComplete(dayIndex: number) {
    setMilestone(MILESTONES.has(dayIndex) ? dayIndex : null)
    setCelebrate(true)
  }

  return (
    <main className="dash">
      <nav className="dash-nav">
        <Link href="/" className="wordmark font-display brand">
          75 Create
        </Link>
        <div className="nav-links font-mono">
          <Link href="/settings">Settings</Link>
          <Link href="/dashboard/share">Share</Link>
        </div>
      </nav>

      <StreakHeader
        dayIndex={currentIndex}
        current={derived.streak.current}
        longest={derived.streak.longest}
        totalDays={total}
      />

      {banner && (
        <div className="banner-slot">
          <MissPolicyBanner
            banner={banner}
            whyNote={challenge.whyNote}
            onConfirmReset={confirmReset}
            onDismiss={dismissBanner}
          />
        </div>
      )}

      {finalComplete && (
        <div className="finish panel">
          <div>
            <span className="eyebrow">You reached the end</span>
            <h2 className="font-display finish-h2">75 days, done.</h2>
          </div>
          <Link href="/recap" className="btn">
            See your recap →
          </Link>
        </div>
      )}

      <div className="main-cols">
        <div className="col-card">
          {preStart && (
            <div className="panel prestart">
              <span className="eyebrow">Not started yet</span>
              <h2 className="font-display">Your challenge begins {challenge.startDate}.</h2>
              <p>The grid is set. Come back on your start date for Day 1.</p>
            </div>
          )}
          {withinWindow && (
            <DayCard
              repo={repo}
              challenge={challenge}
              dayIndex={currentIndex}
              dayData={dayData}
              refresh={refresh}
              onComplete={handleComplete}
            />
          )}
          {elapsed && !finalComplete && (
            <div className="panel prestart">
              <span className="eyebrow">Window elapsed</span>
              <h2 className="font-display">The 75-day window has passed.</h2>
              <p>You can review what you made, or start a fresh round from settings.</p>
              <Link href="/recap" className="btn btn-ghost" style={{ marginTop: '1rem' }}>
                View recap
              </Link>
            </div>
          )}
        </div>

        <div className="col-grid">
          <div className="grid-panel panel">
            <div className="grid-caption">
              <span className="eyebrow">The grid</span>
              <span className="grid-legend font-mono">
                <i className="sw sw-c" /> made <i className="sw sw-s" /> skipped{' '}
                <i className="sw sw-m" /> missed
              </span>
            </div>
            <Grid days={derived.days} />
          </div>
        </div>
      </div>

      <PastAttempts />

      <Celebration
        show={celebrate}
        milestone={milestone}
        onDone={() => setCelebrate(false)}
      />

      <style jsx>{`
        .dash {
          max-width: 1080px;
          padding-top: 1rem;
        }
        .loading {
          color: var(--muted);
          padding: 4rem 0;
        }
        .dash-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0 2rem;
        }
        .brand {
          font-size: 1.25rem;
          text-decoration: none;
        }
        .nav-links {
          display: flex;
          gap: 1.25rem;
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .nav-links :global(a) {
          color: var(--ink-soft);
          text-decoration: none;
        }
        .nav-links :global(a:hover) {
          color: var(--coral);
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
          margin: 0.25rem 0 0;
        }
        .main-cols {
          display: grid;
          grid-template-columns: 1fr 1fr;
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
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .grid-legend {
          font-size: 0.64rem;
          color: var(--muted);
        }
        .prestart {
          padding: 1.75rem;
        }
        .prestart h2 {
          font-size: 1.5rem;
          margin: 0.4rem 0 0.6rem;
        }
        .prestart p {
          color: var(--ink-soft);
          margin: 0;
          line-height: 1.5;
        }
        @media (max-width: 860px) {
          .main-cols {
            grid-template-columns: 1fr;
          }
          .grid-panel {
            position: static;
          }
        }
      `}</style>
    </main>
  )
}
