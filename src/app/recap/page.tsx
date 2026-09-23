'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/components/AppProvider'
import { Grid } from '@/components/Grid'
import { ArtifactThumb } from '@/components/ArtifactInput'
import { generateCertificate, downloadBlob } from '@/lib/certificate'

export default function Recap() {
  const { loading, user, challenge, dayData, derived, phase, repo, enterMaintenance, closeForNewRound } = useApp()
  const router = useRouter()
  const [building, setBuilding] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) router.replace('/signin')
    else if (!challenge) router.replace('/setup')
  }, [loading, user, challenge, router])

  const stats = useMemo(() => {
    const completedDays = Object.keys(dayData.completions).length
    return {
      completedDays,
      longest: derived.streak.longest,
      totalMinutes: completedDays * 30,
    }
  }, [dayData, derived])

  const artifactDays = useMemo(() => {
    return Object.entries(dayData.artifacts)
      .map(([idx, list]) => ({ day: Number(idx), artifacts: list }))
      .filter((d) => d.artifacts.length > 0)
      .sort((a, b) => a.day - b.day)
  }, [dayData.artifacts])

  if (loading || !user || !challenge) return null

  async function downloadCert() {
    if (!challenge) return
    setBuilding(true)
    try {
      const blob = await generateCertificate({
        dayStates: derived.days.map((d) => d.state),
        longest: stats.longest,
        completedDays: stats.completedDays,
        totalMinutes: stats.totalMinutes,
        medium: challenge.medium,
        startDate: challenge.startDate,
      })
      downloadBlob(blob, '75-create-certificate.png')
    } finally {
      setBuilding(false)
    }
  }

  function startMaintenance() {
    enterMaintenance()
    router.push('/dashboard')
  }

  function newRound() {
    closeForNewRound()
    router.push('/setup')
  }

  return (
    <main className="recap">
      <nav className="recap-nav">
        <Link href="/dashboard" className="wordmark font-display brand">
          75 Create
        </Link>
        <Link href="/dashboard" className="font-mono back">
          Back to your grid
        </Link>
      </nav>

      <header className="recap-head">
        <h1 className="font-display recap-h1">
          {stats.completedDays >= 75 ? '75 days, made.' : 'Here’s what you made.'}
        </h1>
      </header>

      <div className="stat-row">
        <Stat big={String(stats.completedDays)} label="days completed" />
        <Stat big={String(stats.longest)} label="longest streak" />
        <Stat big={`${stats.totalMinutes.toLocaleString()}+`} label="minutes, at 30 a day" />
      </div>

      <div className="grid-panel panel">
        <Grid days={derived.days} />
      </div>

      <div className="cert-row">
        <div>
          <h2 className="font-display cert-h2">Take the certificate.</h2>
          <p className="cert-sub">
            A PNG with your stats and the finished grid. No artifacts included —
            share it anywhere.
          </p>
        </div>
        <button className="btn" onClick={downloadCert} disabled={building}>
          {building ? 'Rendering…' : 'Download certificate'}
        </button>
      </div>

      <section className="gallery">
        <h2 className="font-display cert-h2">The work, day by day</h2>
        {artifactDays.length === 0 ? (
          <p className="empty font-mono">
            No artifacts captured yet — they’ll appear here as you add them.
          </p>
        ) : (
          <div className="timeline">
            {artifactDays.map(({ day, artifacts }) => (
              <div key={day} className="tl-day">
                <span className="tl-num font-mono">Day {day}</span>
                <div className="tl-arts">
                  {artifacts.map((a) => (
                    <ArtifactThumb key={a.id} artifact={a} repo={repo} size={120} />
                  ))}
                </div>
                {dayData.logs[day]?.text && (
                  <p className="tl-log">{dayData.logs[day].text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {(phase === 'finished' || phase === 'maintenance') && (
        <section className="next panel">
          <div>
            <h2 className="font-display cert-h2">Keep the habit, or run it back.</h2>
            <p className="cert-sub">
              {phase === 'maintenance'
                ? 'You are in maintenance mode: a daily log, no rules, no resets. Start a fresh 75 whenever you like.'
                : 'Maintenance mode keeps a daily log with no rules and no reset stakes. Or start a fresh 75.'}
            </p>
          </div>
          <div className="next-actions">
            {phase === 'finished' && (
              <button className="btn btn-ghost" onClick={startMaintenance}>
                Maintenance mode
              </button>
            )}
            <button className="btn" onClick={newRound}>
              Start a new round
            </button>
          </div>
        </section>
      )}

      <style jsx>{`
        .recap {
          max-width: 900px;
          padding-top: 1rem;
        }
        .recap-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0 2rem;
        }
        .brand {
          font-size: 1.25rem;
          text-decoration: none;
        }
        .back {
          font-size: 0.78rem;
          color: var(--ink-soft);
          text-decoration: none;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .recap-h1 {
          font-size: clamp(2.4rem, 8vw, 4rem);
          margin: 0.5rem 0 0;
        }
        .stat-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin: 2rem 0;
        }
        .grid-panel {
          padding: 1.5rem;
        }
        .cert-row,
        .next {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1.5rem;
          flex-wrap: wrap;
          margin-top: 2.5rem;
        }
        .cert-row {
          padding: 1.5rem;
          border: 1.5px solid var(--line);
          border-radius: 14px;
          box-shadow: 4px 5px 0 var(--marigold);
        }
        .cert-h2 {
          font-size: 1.5rem;
          margin: 0 0 0.4rem;
        }
        .cert-sub {
          color: var(--ink-soft);
          margin: 0;
          max-width: 46ch;
          line-height: 1.5;
        }
        .gallery {
          margin-top: 3rem;
        }
        .gallery .cert-h2 {
          margin: 0.4rem 0 1.5rem;
        }
        .empty {
          color: var(--muted);
        }
        .timeline {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .tl-day {
          border-left: 2px solid var(--line);
          padding-left: 1.25rem;
        }
        .tl-num {
          font-size: 0.72rem;
          color: var(--coral-ink);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .tl-arts {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
          margin: 0.6rem 0;
        }
        .tl-log {
          color: var(--ink-soft);
          margin: 0;
          font-size: 0.92rem;
          line-height: 1.5;
        }
        .next {
          padding: 1.75rem;
          margin-top: 3rem;
        }
        .next-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        @media (max-width: 640px) {
          .stat-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}

function Stat({ big, label }: { big: string; label: string }) {
  return (
    <div className="stat panel">
      <div className="big font-display">{big}</div>
      <div className="label font-mono">{label}</div>
      <style jsx>{`
        .stat {
          padding: 1.5rem;
          text-align: center;
        }
        .big {
          font-size: clamp(2.2rem, 8vw, 3rem);
          color: var(--cobalt);
        }
        .label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--muted);
          margin-top: 0.3rem;
        }
      `}</style>
    </div>
  )
}
