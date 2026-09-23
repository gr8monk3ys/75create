'use client'

import { useEffect, useRef, useState } from 'react'
import { Repository } from '@/lib/repository'
import { Artifact } from '@/lib/types'
import { ImageError, compressImage } from '@/lib/image'
import { normalizeArtifactUrl, safeHref } from '@/lib/safeUrl'
import { ToggleResult } from '@/lib/challengeSession'
import { Icon } from './Icon'

interface Props {
  repo: Repository
  dayIndex: number
  artifacts: Artifact[]
  attachImage: (dayIndex: number, blob: Blob) => Promise<ToggleResult>
  attachLink: (dayIndex: number, url: string) => ToggleResult
  removeArtifact: (dayIndex: number, artifactId: string) => Promise<ToggleResult>
  /** Whether removing an artifact would take a completed today off the grid. */
  wouldReopen: (dayIndex: number, artifactId: string) => boolean
  /** Called with each write's result, so the card can celebrate completion.
   *  Returns true when it announced something itself (completion, reopening). */
  onResult: (result: ToggleResult) => boolean | void
  /** Says a short confirmation through the card's live region. */
  onAnnounce?: (message: string) => void
  /** Id of the element that labels this group (the rule or field heading). */
  labelledBy?: string
  /** The rule's note, when shown. */
  describedBy?: string
  /** Id for the upload button, so a rule label can point at it. */
  uploadId?: string
}

export function ArtifactInput({
  repo,
  dayIndex,
  artifacts,
  attachImage,
  attachLink,
  removeArtifact,
  wouldReopen,
  onResult,
  onAnnounce,
  labelledBy,
  describedBy,
  uploadId,
}: Props) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLButtonElement>(null)

  /** Report a write: the card speaks for completion; otherwise say what was kept. */
  function report(result: ToggleResult, added: string) {
    const spoke = onResult(result)
    if (result.ok && !spoke) onAnnounce?.(added)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const { blob } = await compressImage(file)
      report(await attachImage(dayIndex, blob), 'Image added.')
    } catch (err) {
      const why = err instanceof ImageError ? err.message : 'That upload didn’t work.'
      setError(`${why} Try a JPEG or PNG under 5 MB, or paste a link instead.`)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function addUrl() {
    const value = normalizeArtifactUrl(url)
    if (!value) {
      if (url.trim()) setError('That isn’t a web address. Paste a link like example.com/my-work.')
      return
    }
    setError(null)
    report(attachLink(dayIndex, value), `Link to ${hostOf(value)} added.`)
    setUrl('')
  }

  return (
    <div className="artifact" role="group" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {artifacts.length > 0 && (
        <ul className="thumbs" aria-label="Today's artifacts">
          {artifacts.map((a) => (
            <li key={a.id}>
              <ArtifactThumb
                artifact={a}
                repo={repo}
                dayIndex={dayIndex}
                reopens={wouldReopen(dayIndex, a.id)}
                onRemove={async () => {
                  // The thumb (and its button) is about to go: keep focus in
                  // the group rather than dropping it to the page.
                  uploadRef.current?.focus()
                  report(
                    await removeArtifact(dayIndex, a.id),
                    a.kind === 'url' ? `Link to ${hostOf(a.url ?? '')} removed.` : 'Image removed.',
                  )
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="controls">
        <button
          ref={uploadRef}
          id={uploadId}
          type="button"
          className="btn btn-ghost small"
          // aria-disabled, not disabled: the button keeps focus while the
          // image compresses, so the keyboard stays in the card.
          onClick={() => !busy && fileRef.current?.click()}
          aria-disabled={busy}
          aria-busy={busy}
        >
          <Icon name="image" size={18} />
          {busy ? 'Compressing…' : 'Upload image'}
        </button>
        <div className="url-row">
          <label className="sr-only" htmlFor={`url-${dayIndex}`}>
            Or paste a link to the work
          </label>
          <input
            id={`url-${dayIndex}`}
            className="field-input url-input"
            type="url"
            inputMode="url"
            placeholder="or paste a link"
            value={url}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `url-err-${dayIndex}` : undefined}
            onChange={(e) => {
              setUrl(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
          />
          <button
            type="button"
            className="btn btn-ghost small"
            onClick={addUrl}
            // Stays focusable once the field clears after adding.
            aria-disabled={!url.trim()}
          >
            Add link
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} hidden />
      </div>
      <p className="err" role="alert" id={`url-err-${dayIndex}`}>
        {error}
      </p>

      <style jsx>{`
        .artifact {
          width: 100%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .thumbs {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .controls {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }
        .url-row {
          display: flex;
          gap: 0.4rem;
          flex: 1 1 14rem;
          min-width: 0;
        }
        .url-input {
          flex: 1;
          width: auto;
          min-width: 0;
        }
        /* After the base rule, so it wins: on a small phone (or at large
           text) the link gets the full width and Add link its own line. */
        @media (max-width: 26em) {
          .url-row {
            flex-basis: 100%;
            flex-wrap: wrap;
          }
          .url-input {
            flex: 1 1 100%;
          }
        }
        .err {
          font-size: 0.8rem;
          line-height: 1.4;
          color: var(--coral-ink);
          margin: 0;
        }
        .err:empty {
          display: none;
        }
      `}</style>
    </div>
  )
}

/** The host of a link, for a thumbnail that says where it goes. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'link'
  }
}

/**
 * One artifact. With `onRemove`, removal takes two taps: the first arms it and
 * says so, the second deletes. An image is gone for good once removed, so a
 * stray tap on a phone must not be enough.
 */
export function ArtifactThumb({
  artifact,
  repo,
  onRemove,
  dayIndex,
  reopens = false,
  size = 84,
}: {
  artifact: Artifact
  repo: Repository
  onRemove?: () => void
  dayIndex?: number
  /** Removing this would take a completed day back off the grid. */
  reopens?: boolean
  size?: number
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [armed, setArmed] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  // A finished recap can hold 75+ images: read and decode each one only when
  // it scrolls near the viewport, not all at once on mount.
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = boxRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          io.disconnect()
        }
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    if (near && artifact.kind === 'image' && artifact.blobRef) {
      repo.getArtifactBlob(artifact.blobRef).then((blob) => {
        if (blob && !cancelled) {
          objectUrl = URL.createObjectURL(blob)
          setSrc(objectUrl)
        }
      })
    }
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [artifact, repo, near])

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  // Re-checked at render: a row synced from another device, or stored before
  // validation existed, can still carry an unsafe scheme.
  const href = artifact.kind === 'url' ? safeHref(artifact.url) : null
  const what = artifact.kind === 'image' ? 'image' : `link to ${href ? hostOf(href) : 'an unsafe address'}`
  const alt = dayIndex ? `Day ${dayIndex} image` : 'Artifact image'

  return (
    <div ref={boxRef} className={`thumb ${armed ? 'armed' : ''}`} style={{ width: size, height: size }}>
      <div className="frame">
        {artifact.kind === 'image' ? (
          src ? (
            // A local object URL from IndexedDB: nothing for next/image to optimize.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt} decoding="async" />
          ) : (
            <span className="ph" role="img" aria-label="Loading image" />
          )
        ) : href ? (
          <a href={href} target="_blank" rel="noreferrer" className="link" title={href}>
            <Icon name="link" size={20} />
            <span className="host">{hostOf(href)}</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <span className="link unsafe">Unsafe link hidden</span>
        )}
      </div>
      {onRemove && (
        <button
          type="button"
          className="x"
          onClick={() => (armed ? onRemove() : setArmed(true))}
          aria-label={
            armed
              ? `Confirm: remove this ${what}${reopens ? '. Today will no longer be complete' : ''}`
              : `Remove this ${what}`
          }
        >
          {armed ? (
            <span className="confirm">
              Remove?
              {reopens && (
                <>
                  <br />
                  Day reopens
                </>
              )}
            </span>
          ) : (
            <Icon name="close" size={16} />
          )}
        </button>
      )}
      <style jsx>{`
        .thumb {
          position: relative;
        }
        .frame {
          width: 100%;
          height: 100%;
          border-radius: 10px;
          overflow: hidden;
          border: 1.5px solid var(--line);
          background: var(--paper);
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          place-items: center;
        }
        .thumb.armed .frame {
          border-color: var(--coral);
        }
        .thumb :global(img) {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .link {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 0.3rem;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--cobalt);
          text-align: center;
          padding: 0.4rem;
          text-decoration: none;
          max-width: 100%;
          min-width: 0;
        }
        .host {
          display: block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .unsafe {
          color: var(--coral-ink);
        }
        .ph {
          width: 40%;
          height: 40%;
          border-radius: 50%;
          background: var(--paper-3);
        }
        .x {
          position: absolute;
          top: 0;
          right: 0;
          /* The visible chip is small; the hit area is a full 44px corner. */
          min-width: 44px;
          height: 44px;
          padding: 0;
          border: none;
          background: transparent;
          color: var(--paper);
          cursor: pointer;
          display: grid;
          place-items: start end;
        }
        .x :global(svg),
        .confirm {
          background: color-mix(in srgb, var(--ink) 78%, transparent);
          border-radius: 999px;
          margin: 4px;
        }
        .x :global(svg) {
          padding: 3px;
          width: 24px;
          height: 24px;
        }
        .thumb.armed .x {
          /* Armed, the confirm takes the whole tile: it can't be clipped or
             run off-screen, and it is the one thing left to decide. */
          inset: 0;
          width: 100%;
          height: 100%;
          place-items: center;
        }
        .confirm {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          line-height: 1.25;
          text-align: center;
          padding: 0.35rem 0.5rem;
          /* A card-like block, not a pill: it wraps to two lines. */
          border-radius: 10px;
          background: var(--coral-ink);
          color: var(--on-coral-ink);
        }
      `}</style>
    </div>
  )
}
