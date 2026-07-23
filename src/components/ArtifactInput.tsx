'use client'

import { useEffect, useRef, useState } from 'react'
import { Repository, newId } from '@/lib/repository'
import { Artifact } from '@/lib/types'
import { compressImage } from '@/lib/image'

interface Props {
  repo: Repository
  challengeId: string
  dayIndex: number
  artifacts: Artifact[]
  onChange: () => void
  readOnly?: boolean
}

export function ArtifactInput({
  repo,
  challengeId,
  dayIndex,
  artifacts,
  onChange,
  readOnly = false,
}: Props) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const { blob } = await compressImage(file)
      const blobRef = await repo.saveArtifactBlob(blob)
      const artifact: Artifact = {
        id: newId(),
        dayId: `${challengeId}:${dayIndex}`,
        kind: 'image',
        blobRef,
        createdAt: new Date().toISOString(),
      }
      repo.saveArtifactMeta(challengeId, dayIndex, artifact)
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function addUrl() {
    const value = url.trim()
    if (!value) return
    const artifact: Artifact = {
      id: newId(),
      dayId: `${challengeId}:${dayIndex}`,
      kind: 'url',
      url: value,
      createdAt: new Date().toISOString(),
    }
    repo.saveArtifactMeta(challengeId, dayIndex, artifact)
    setUrl('')
    onChange()
  }

  async function removeArtifact(a: Artifact) {
    if (a.blobRef) await repo.deleteArtifactBlob(a.blobRef)
    repo.deleteArtifactMeta(challengeId, dayIndex, a.id)
    onChange()
  }

  return (
    <div className="artifact">
      {artifacts.length > 0 && (
        <div className="thumbs">
          {artifacts.map((a) => (
            <ArtifactThumb
              key={a.id}
              artifact={a}
              repo={repo}
              onRemove={readOnly ? undefined : () => removeArtifact(a)}
            />
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="controls">
          <button
            type="button"
            className="btn btn-ghost small"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? 'Compressing…' : 'Upload image'}
          </button>
          <span className="or font-mono">or</span>
          <div className="url-row">
            <input
              className="url-input"
              placeholder="paste a link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
            />
            <button type="button" className="btn btn-ghost small" onClick={addUrl}>
              Add
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onFile}
            hidden
          />
        </div>
      )}
      {error && <p className="err font-mono">{error}</p>}

      <style jsx>{`
        .artifact {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .thumbs {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
        }
        .controls {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }
        .small {
          padding: 0.5rem 0.9rem;
          font-size: 0.7rem;
        }
        .or {
          font-size: 0.7rem;
          color: var(--muted);
        }
        .url-row {
          display: flex;
          gap: 0.4rem;
          flex: 1;
          min-width: 180px;
        }
        .url-input {
          flex: 1;
          font-family: var(--font-body);
          font-size: 0.85rem;
          padding: 0.5rem 0.7rem;
          border-radius: 8px;
          border: 1.5px solid var(--line);
          background: var(--paper);
          color: var(--ink);
        }
        .url-input:focus {
          outline: none;
          border-color: var(--cobalt);
        }
        .err {
          font-size: 0.72rem;
          color: var(--coral);
          margin: 0;
        }
      `}</style>
    </div>
  )
}

function ArtifactThumb({
  artifact,
  repo,
  onRemove,
}: {
  artifact: Artifact
  repo: Repository
  onRemove?: () => void
}) {
  const [src, setSrc] = useState<string | null>(null)

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

  return (
    <div className="thumb">
      {artifact.kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        src ? <img src={src} alt="Day artifact" /> : <span className="ph">…</span>
      ) : (
        <a href={artifact.url} target="_blank" rel="noreferrer" className="link font-mono">
          🔗 link
        </a>
      )}
      {onRemove && (
        <button className="x" onClick={onRemove} aria-label="Remove artifact">
          ✕
        </button>
      )}
      <style jsx>{`
        .thumb {
          position: relative;
          width: 76px;
          height: 76px;
          border-radius: 8px;
          overflow: hidden;
          border: 1.5px solid var(--line);
          background: var(--paper);
          display: grid;
          place-items: center;
        }
        .thumb :global(img) {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .link {
          font-size: 0.68rem;
          color: var(--cobalt);
          text-align: center;
          padding: 0.3rem;
        }
        .ph {
          color: var(--muted);
        }
        .x {
          position: absolute;
          top: 3px;
          right: 3px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: none;
          background: color-mix(in srgb, var(--ink) 70%, transparent);
          color: var(--paper);
          font-size: 0.65rem;
          cursor: pointer;
          display: grid;
          place-items: center;
        }
      `}</style>
    </div>
  )
}
