// One-click export of all logs and artifacts as a ZIP (design spec §6, F9).

import JSZip from 'jszip'
import { Repository } from './repository'
import { Challenge } from './types'

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export async function buildExport(repo: Repository): Promise<Blob> {
  const zip = new JSZip()
  const user = repo.getUser()
  const challenges = repo.getChallenges()

  const jsonExport: {
    user: { email: string; tz: string } | null
    challenges: unknown[]
  } = {
    user: user ? { email: user.email, tz: user.tz } : null,
    challenges: [],
  }

  const csvRows: string[] = ['challenge_id,medium,day,completed_at,log']

  for (const challenge of challenges) {
    const dd = repo.getDayData(challenge.id)
    jsonExport.challenges.push({
      ...challenge,
      days: dd.completions,
      logs: dd.logs,
      skips: dd.skips,
    })

    const dayIndices = new Set<number>([
      ...Object.keys(dd.completions).map(Number),
      ...Object.keys(dd.logs).map(Number),
    ])
    for (const idx of [...dayIndices].sort((a, b) => a - b)) {
      const completedAt = dd.completions[idx] ?? ''
      const log = dd.logs[idx]?.text ?? ''
      csvRows.push(
        [
          challenge.id,
          challenge.medium,
          String(idx),
          completedAt,
          csvEscape(log),
        ].join(','),
      )
    }

    // artifact image files
    await addArtifacts(zip, repo, challenge)
  }

  zip.file('logs.json', JSON.stringify(jsonExport, null, 2))
  zip.file('logs.csv', csvRows.join('\n'))
  zip.file(
    'README.txt',
    'Your 75 Create export.\n\n' +
      '- logs.json: everything, structured.\n' +
      '- logs.csv: one row per logged day.\n' +
      '- artifacts/: your uploaded images, grouped by challenge and day.\n',
  )

  return zip.generateAsync({ type: 'blob' })
}

async function addArtifacts(
  zip: JSZip,
  repo: Repository,
  challenge: Challenge,
): Promise<void> {
  const dd = repo.getDayData(challenge.id)
  for (const [dayIndex, list] of Object.entries(dd.artifacts)) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i]
      if (a.kind === 'image' && a.blobRef) {
        const blob = await repo.getArtifactBlob(a.blobRef)
        if (blob) {
          zip.file(
            `artifacts/${challenge.id}/day-${dayIndex}-${i + 1}.jpg`,
            blob,
          )
        }
      }
    }
  }
}
