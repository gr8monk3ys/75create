// Encodes a read-only progress snapshot into a URL-fragment-safe string so a
// share link carries its own data — no server needed. (Design spec §6, F8.)

import { DayState, Medium, MissPolicy } from './types'

export interface ShareSnapshot {
  medium: Medium
  startDate: string
  missPolicy: MissPolicy
  dayStates: DayState[]
  /** The day index when shared. Absent from links made before it existed. */
  dayIndex?: number
  current: number
  longest: number
  includeLogs: boolean
  /** dayIndex -> log text; empty when includeLogs is false. */
  logs: Record<number, string>
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function encodeSnapshot(snap: ShareSnapshot): string {
  const json = JSON.stringify(snap)
  const bytes = new TextEncoder().encode(json)
  return toBase64Url(bytes)
}

const STATES = new Set<string>(['future', 'complete', 'missed', 'skipped', 'today'])

export function decodeSnapshot(fragment: string): ShareSnapshot | null {
  try {
    const bytes = fromBase64Url(fragment)
    const json = new TextDecoder().decode(bytes)
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.dayStates)) return null
    // A link is untrusted input: anything the viewer reads must have the
    // shape it expects, or the page could throw on a crafted fragment.
    if (!parsed.dayStates.every((s: unknown) => typeof s === 'string' && STATES.has(s))) return null
    if (parsed.dayIndex !== undefined && !Number.isInteger(parsed.dayIndex)) delete parsed.dayIndex
    const logs: Record<number, string> = {}
    if (parsed.logs && typeof parsed.logs === 'object') {
      for (const [day, text] of Object.entries(parsed.logs)) {
        if (Number.isInteger(Number(day)) && typeof text === 'string') logs[Number(day)] = text
      }
    }
    return {
      medium: typeof parsed.medium === 'string' ? parsed.medium : 'other',
      startDate: typeof parsed.startDate === 'string' ? parsed.startDate : '',
      missPolicy: ['classic', 'grace', 'extend'].includes(parsed.missPolicy) ? parsed.missPolicy : 'classic',
      dayStates: parsed.dayStates,
      dayIndex: parsed.dayIndex,
      current: Number.isFinite(parsed.current) ? parsed.current : 0,
      longest: Number.isFinite(parsed.longest) ? parsed.longest : 0,
      includeLogs: parsed.includeLogs === true,
      logs,
    } as ShareSnapshot
  } catch {
    return null
  }
}
