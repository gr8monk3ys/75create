'use client'

import { useEffect, useRef, useState } from 'react'
import { Repository } from '@/lib/repository'
import { Artifact } from '@/lib/types'
import { compressImage } from '@/lib/image'
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
  /** Called with each write's result, so the card can celebrate completion. */
  onResult: (result: ToggleResult) => void
  /** Id of the element that labels this group (the rule or field heading). */
  labelledBy?: string
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
  labelledBy,
  uploadId,
}: Props) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLButtonElement>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const { blob } = await compressImage(file)
      onResult(await attachImage(dayIndex, blob))
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} Try a JPEG or PNG under 5 MB, or paste a link instead.`
          : 'That upload didn’t work. Try a JPEG or PNG under 5 MB, or paste a link instead.',
      )
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function addUrl() {
    const value = normalizeArtifactUrl(url)
    if (!value) {
      if (url.trim()) setError('That isn’t a web link. Paste an address that starts with https://.')
      return
    }
    setError(null)
    onResult(attachLink(dayIndex, value))
    setUrl('')
  }

  return (
    <div className="artifact" role="group" aria-labelledby={labelledBy}>
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
                  onResult(await removeArtifact(dayIndex, a.id))
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
          onClick={() => fileRef.current?.click()}
          disabled={busy}
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
            className="url-input"
            type="url"
            inputMode="url"
            placeholder="or paste a link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
          />
          <button type="button" className="btn btn-ghost small" onClick={addUrl} disabled={!url.trim()}>
            Add link
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} hidden />
      </div>
      <p className="err" role="alert">
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
        .small {
          /* 44px min height: comfortable thumb target on a phone. */
          padding: 0.6rem 1rem;
          min-height: 44px;
          font-size: 0.75rem;
        }
        .url-row {
          display: flex;
          gap: 0.4rem;
          flex: 1 1 14rem;
          min-width: 0;
        }
        .url-input {
          flex: 1;
          min-width: 0;
          font-family: var(--font-body);
          /* 16px stops iOS Safari zooming the viewport on focus. */
          font-size: 1rem;
          min-height: 44px;
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          border: 1.5px solid var(--line);
          background: var(--paper);
          color: var(--ink);
        }
        .url-input::placeholder {
          color: var(--muted);
        }
        .url-input:focus {
          border-color: var(--cobalt);
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

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    if (artifact.kind === 'image' && artifact.blobRef) {
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
  }, [artifact, repo])

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
  const confirm = reopens ? 'Remove? Day reopens' : 'Remove?'

  return (
    <div className={`thumb ${armed ? 'armed' : ''}`} style={{ width: size, height: size }}>
      <div className="frame">
        {artifact.kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          src ? <img src={src} alt={alt} /> : <span className="ph" aria-label="Loading image" />
        ) : href ? (
          <a href={href} target="_blank" rel="noreferrer" className="link">
            <Icon name="link" size={20} />
            <span className="host">{hostOf(href)}</span>
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
          {armed ? <span className="confirm">{confirm}</span> : <Icon name="close" size={16} />}
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
          font-size: 0.72rem;
          color: var(--cobalt);
          text-align: center;
          padding: 0.4rem;
          text-decoration: none;
          max-width: 100%;
        }
        .host {
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
        .confirm {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          white-space: nowrap;
          padding: 0.3rem 0.5rem;
          background: var(--coral-ink);
          color: #fff;
        }
      `}</style>
    </div>
  )
}
