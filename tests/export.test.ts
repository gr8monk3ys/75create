import { describe, it, expect, beforeEach } from 'bun:test'
import JSZip from 'jszip'
import { LocalRepository } from '@/lib/localRepository'
import { buildExport } from '@/lib/export'
import { createChallengeSession } from '@/lib/challengeSession'
import { DEFAULT_RULES, User } from '@/lib/types'

const USER: User = {
  id: 'u1',
  email: 'a@b.com',
  tz: 'UTC',
  lateNightBufferHrs: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  reminderTime: null,
}

let repo: LocalRepository

beforeEach(async () => {
  localStorage.clear()
  repo = new LocalRepository()
  await repo.deleteAllData()
  repo.saveUser(USER)
  repo.setSignedIn(true)
})

describe('export', () => {
  it('keeps links, ticks and logs, not just images', async () => {
    const session = createChallengeSession(repo, () => new Date(Date.UTC(2026, 0, 1, 12)))
    const c = session.start({ medium: 'drawing', rules: DEFAULT_RULES, missPolicy: 'classic', start: 'today', whyNote: '' })
    session.toggleRule(1, DEFAULT_RULES.find((r) => !r.evidence)!.id)
    session.saveLog(1, 'a line, with "quotes"')
    session.attachLink(1, 'https://example.com/study.png')

    const zip = await JSZip.loadAsync(await (await buildExport(repo)).arrayBuffer())
    const json = JSON.parse(await zip.file('logs.json')!.async('string'))
    const exported = json.challenges.find((x: { id: string }) => x.id === c.id)
    expect(exported.artifacts['1']).toEqual([
      expect.objectContaining({ kind: 'url', url: 'https://example.com/study.png' }),
    ])
    expect(Object.values(exported.checks)).toContain(true)

    const csv = await zip.file('logs.csv')!.async('string')
    expect(csv.split('\n')[0]).toBe('challenge_id,medium,day,completed_at,log,links')
    expect(csv).toContain('"a line, with ""quotes"""')
    expect(csv).toContain('https://example.com/study.png')
  })
})
