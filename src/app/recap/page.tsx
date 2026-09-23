'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/components/AppProvider'
import { Grid } from '@/components/Grid'
import { finishLine, shortDate } from '@/lib/format'
import { ArtifactThumb } from '@/components/ArtifactInput'
import { generateCertificate, downloadBlob } from '@/lib/certificate'

export default function Recap() {
  const { loading, user, challenge, dayData, derived, phase, enterMaintenance, closeForNewRound } = useApp()
  const router = useRouter()
  const [building, setBuilding] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) router.replace('/signin')
    else if (!challenge) router.replace('/setup')
  }, [loading, user, challenge, router])

  // Only facts the app recorded (the session counts them). It never measures
  // time, so no "minutes".
  const { tally } = derived
  const longest = derived.streak.longest
  const ended = phase === 'finished' || phase === 'maintenance'
  const title = ended
    ? finishLine(tally, derived.totalDays).title
    : `${tally.made} ${tally.made === 1 ? 'day' : 'days'}, made.`

  const artifactDays = useMemo(() => {
    return Object.entries(dayData.artifacts)
      .map(([idx, list]) => ({ day: Number(idx), artifacts: list }))
      .filter((d) => d.artifacts.length > 0)
      .sort((a, b) => a.day - b.day)
  }, [dayData.artifacts])

  if (loading || !user || !challenge) {
    return (
      <main>
        <p className="status-line" role="status">
          Loading your recap…
        </p>
      </main>
    )
  }

  async function downloadCert() {
    if (!challenge) return
    setBuilding(true)
    try {
      const blob = await generateCertificate({
        dayStates: derived.days.map((d) => d.state),
        title,
        longest,
        completedDays: tally.made,
        logsWritten: tally.logsWritten,
        artifactsKept: tally.artifactsKept,
        medium: challenge.medium,
        startDate: shortDate(challenge.startDate),
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
      <nav className="page-nav" aria-label="Main">
        <Link href="/dashboard" className="wordmark font-display brand">
          75 Create
        </Link>
        <Link href="/dashboard" className="back-link">
          Back to your grid
        </Link>
      </nav>

      <header className="recap-head">
        <h1 className="font-display recap-h1">
          {ended ? title : 'Here’s what you made.'}
        </h1>
      </header>

      <dl className="facts">
        <Fact n={tally.made} label={tally.made === 1 ? 'day made' : 'days made'} made />
        <Fact n={longest} label="longest streak" />
        <Fact n={tally.logsWritten} label={tally.logsWritten === 1 ? 'log written' : 'logs written'} />
        <Fact n={tally.artifactsKept} label={tally.artifactsKept === 1 ? 'piece kept' : 'pieces kept'} />
      </dl>

      <div className="grid-panel panel">
        <Grid days={derived.days} />
      </div>

      <div className="cert-row">
        {ended ? (
          <>
            <div className="cert-text">
              <h2 className="font-display cert-h2">Take the certificate.</h2>
              <p className="cert-sub">
                A PNG with your stats and the finished grid. No artifacts included —
                share it anywhere.
              </p>
            </div>
            <button
              className="btn"
              onClick={() => !building && downloadCert()}
              aria-disabled={building}
            >
              {building ? 'Rendering…' : 'Download certificate'}
            </button>
          </>
        ) : (
          // A certificate of completion is earned: it isn't offered mid-way.
          <div className="cert-text">
            <h2 className="font-display cert-h2">The certificate comes at the end.</h2>
            <p className="cert-sub">
              Finish Day {derived.totalDays} and it’s here: your stats and the whole grid, as a
              PNG to share.
            </p>
          </div>
        )}
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
                    <ArtifactThumb key={a.id} artifact={a} size={120} dayIndex={day} />
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
        .recap-h1 {
          font-size: clamp(2.4rem, 8vw, 4rem);
          margin: 0.5rem 0 1.5rem;
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
        }
        .cert-text {
          flex: 1 1 16rem;
          min-width: 0;
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
          font-size: 0.875rem;
        }
        .timeline {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .tl-day {
          border-top: 1.5px dashed var(--line);
          padding-top: 1rem;
        }
        .tl-num {
          font-size: 0.8rem;
          color: var(--muted);
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
          font-size: 0.875rem;
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
        .facts {
          display: flex;
          flex-wrap: wrap;
          gap: 1.25rem 2.5rem;
          margin: 0 0 2rem;
        }
      `}</style>
    </main>
  )
}

/** One recorded fact. Only days made wear cobalt: that pigment means made. */
function Fact({ n, label, made = false }: { n: number; label: string; made?: boolean }) {
  return (
    <div className={`fact ${made ? 'made' : ''}`}>
      <dt>{label}</dt>
      <dd className="font-display">{n}</dd>
      <style jsx>{`
        .fact {
          display: flex;
          flex-direction: column-reverse;
          gap: 0.2rem;
        }
        dd {
          margin: 0;
          font-size: clamp(1.8rem, 7vw, 2.6rem);
          color: var(--ink);
          font-variant-numeric: tabular-nums;
        }
        .made dd {
          color: var(--cobalt);
        }
        dt {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--muted);
        }
      `}</style>
    </div>
  )
}
