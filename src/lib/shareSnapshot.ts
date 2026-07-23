// Encodes a read-only progress snapshot into a URL-fragment-safe string so a
// share link carries its own data — no server needed. (Design spec §6, F8.)

import { DayState, Medium, MissPolicy } from './types'

export interface ShareSnapshot {
  medium: Medium
  startDate: string
  missPolicy: MissPolicy
  dayStates: DayState[]
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

export function decodeSnapshot(fragment: string): ShareSnapshot | null {
  try {
    const bytes = fromBase64Url(fragment)
    const json = new TextDecoder().decode(bytes)
    const parsed = JSON.parse(json)
    if (!parsed || !Array.isArray(parsed.dayStates)) return null
    return parsed as ShareSnapshot
  } catch {
    return null
  }
}
