'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/components/AppProvider'
import { Grid } from '@/components/Grid'
import { generateCertificate, downloadBlob } from '@/lib/certificate'
import { Artifact } from '@/lib/types'

export default function Recap() {
  const { loading, user, challenge, dayData, derived, repo, refresh } = useApp()
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
    if (!challenge) return
    repo.saveChallenge({ ...challenge, status: 'maintenance', maintenanceMode: true })
    refresh()
    router.push('/dashboard')
  }

  function newRound() {
    if (!challenge) return
    repo.saveChallenge({ ...challenge, status: 'completed' })
    refresh()
    router.push('/setup')
  }

  return (
    <main className="recap">
      <nav className="recap-nav">
        <Link href="/dashboard" className="wordmark font-display brand">
          75 Create
        </Link>
        <Link href="/dashboard" className="font-mono back">
          ← back to grid
        </Link>
      </nav>

      <header className="recap-head">
        <span className="eyebrow">Your recap</span>
        <h1 className="font-display recap-h1">
          {stats.completedDays >= 75 ? '75 days, made.' : 'Here’s what you made.'}
        </h1>
      </header>

      <div className="stat-row">
        <Stat big={String(stats.completedDays)} label="days completed" />
        <Stat big={String(stats.longest)} label="longest streak" />
        <Stat big={`${stats.totalMinutes.toLocaleString()}+`} label="minutes created" />
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
        <span className="eyebrow">The work</span>
        <h2 className="font-display cert-h2">Your artifact timeline</h2>
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
                    <GalleryItem key={a.id} artifact={a} />
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

      <section className="next panel">
        <div>
          <span className="eyebrow">What now?</span>
          <h2 className="font-display cert-h2">Keep the habit, or run it back.</h2>
          <p className="cert-sub">
            Maintenance mode keeps the daily check-in with no reset stakes. Or start a
            fresh 75.
          </p>
        </div>
        <div className="next-actions">
          <button className="btn btn-ghost" onClick={startMaintenance}>
            Maintenance mode
          </button>
          <button className="btn" onClick={newRound}>
            Start a new round
          </button>
        </div>
      </section>

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
          color: var(--coral);
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

function GalleryItem({ artifact }: { artifact: Artifact }) {
  const { repo } = useApp()
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    if (artifact.kind === 'image' && artifact.blobRef) {
      repo.getArtifactBlob(artifact.blobRef).then((blob) => {
        if (blob && !cancelled) {
          url = URL.createObjectURL(blob)
          setSrc(url)
        }
      })
    }
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [artifact, repo])

  if (artifact.kind === 'url') {
    return (
      <a href={artifact.url} target="_blank" rel="noreferrer" className="g-link font-mono">
        🔗 link
        <style jsx>{`
          .g-link {
            display: grid;
            place-items: center;
            width: 96px;
            height: 96px;
            border: 1.5px solid var(--line);
            border-radius: 10px;
            color: var(--cobalt);
            font-size: 0.72rem;
            text-decoration: none;
          }
        `}</style>
      </a>
    )
  }

  return (
    <div className="g-img">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt={`Artifact from day`} />}
      <style jsx>{`
        .g-img {
          width: 96px;
          height: 96px;
          border-radius: 10px;
          overflow: hidden;
          border: 1.5px solid var(--line);
          background: var(--paper-2);
        }
        .g-img :global(img) {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      `}</style>
    </div>
  )
}
