// localStorage (structured data) + IndexedDB (artifact blobs) implementation
// of the Repository interface.

import {
  DayData,
  Repository,
  emptyDayData,
  newId,
} from './repository'
import { Artifact, Challenge, Log, User } from './types'

const ROOT_KEY = '75create.v1'
const DB_NAME = '75create'
const DB_STORE = 'artifacts'

interface Root {
  user: User | null
  challenges: Challenge[]
  dayData: Record<string, DayData>
  signedIn: boolean
}

function emptyRoot(): Root {
  return { user: null, challenges: [], dayData: {}, signedIn: false }
}

export class LocalRepository implements Repository {
  // ---- root read/write ----
  private read(): Root {
    if (typeof localStorage === 'undefined') return emptyRoot()
    const raw = localStorage.getItem(ROOT_KEY)
    if (!raw) return emptyRoot()
    try {
      const parsed = JSON.parse(raw) as Root
      return { ...emptyRoot(), ...parsed }
    } catch {
      return emptyRoot()
    }
  }

  private write(root: Root): void {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(ROOT_KEY, JSON.stringify(root))
  }

  private dayDataFor(root: Root, challengeId: string): DayData {
    // Normalize in place so mutations by the caller persist on write, while
    // backfilling any fields missing from older stored data.
    root.dayData[challengeId] = { ...emptyDayData(), ...root.dayData[challengeId] }
    return root.dayData[challengeId]
  }

  // ---- user ----
  getUser(): User | null {
    return this.read().user
  }

  saveUser(user: User): void {
    const root = this.read()
    root.user = user
    this.write(root)
  }

  isSignedIn(): boolean {
    return this.read().signedIn && this.read().user !== null
  }

  setSignedIn(value: boolean): void {
    const root = this.read()
    root.signedIn = value
    this.write(root)
  }

  // ---- challenges ----
  getChallenges(): Challenge[] {
    return this.read().challenges
  }

  saveChallenge(challenge: Challenge): void {
    const root = this.read()
    const i = root.challenges.findIndex((c) => c.id === challenge.id)
    if (i >= 0) root.challenges[i] = challenge
    else root.challenges.push(challenge)
    this.write(root)
  }

  getActiveChallenge(): Challenge | null {
    return (
      this.read().challenges.find(
        (c) => c.status === 'active' || c.status === 'maintenance',
      ) ?? null
    )
  }

  // ---- day data ----
  getDayData(challengeId: string): DayData {
    return { ...emptyDayData(), ...this.read().dayData[challengeId] }
  }

  saveDayCompletion(
    challengeId: string,
    dayIndex: number,
    completedAt: string | null,
  ): void {
    const root = this.read()
    const dd = this.dayDataFor(root, challengeId)
    if (completedAt === null) delete dd.completions[dayIndex]
    else dd.completions[dayIndex] = completedAt
    this.write(root)
  }

  saveLog(challengeId: string, dayIndex: number, log: Log): void {
    const root = this.read()
    const dd = this.dayDataFor(root, challengeId)
    dd.logs[dayIndex] = log
    this.write(root)
  }

  saveCheck(
    challengeId: string,
    dayIndex: number,
    ruleId: string,
    checked: boolean,
  ): void {
    const root = this.read()
    const dd = this.dayDataFor(root, challengeId)
    dd.checks[`${dayIndex}:${ruleId}`] = checked
    this.write(root)
  }

  saveArtifactMeta(
    challengeId: string,
    dayIndex: number,
    artifact: Artifact,
  ): void {
    const root = this.read()
    const dd = this.dayDataFor(root, challengeId)
    if (!dd.artifacts[dayIndex]) dd.artifacts[dayIndex] = []
    dd.artifacts[dayIndex].push(artifact)
    this.write(root)
  }

  deleteArtifactMeta(
    challengeId: string,
    dayIndex: number,
    artifactId: string,
  ): void {
    const root = this.read()
    const dd = this.dayDataFor(root, challengeId)
    dd.artifacts[dayIndex] = (dd.artifacts[dayIndex] ?? []).filter(
      (a) => a.id !== artifactId,
    )
    this.write(root)
  }

  addSkip(challengeId: string, dayIndex: number): void {
    const root = this.read()
    const dd = this.dayDataFor(root, challengeId)
    if (!dd.skips.includes(dayIndex)) dd.skips.push(dayIndex)
    this.write(root)
  }

  addActionedMiss(challengeId: string, dayIndex: number): void {
    const root = this.read()
    const dd = this.dayDataFor(root, challengeId)
    if (!dd.actionedMisses.includes(dayIndex)) dd.actionedMisses.push(dayIndex)
    this.write(root)
  }

  // ---- IndexedDB blobs ----
  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async saveArtifactBlob(blob: Blob): Promise<string> {
    const id = newId()
    // Store the raw bytes + type rather than the Blob itself: ArrayBuffers
    // survive structured clone identically across browsers and test shims.
    const buffer = await blob.arrayBuffer()
    const db = await this.openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite')
      tx.objectStore(DB_STORE).put({ buffer, type: blob.type }, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
    return id
  }

  async getArtifactBlob(id: string): Promise<Blob | null> {
    const db = await this.openDb()
    const record = await new Promise<{ buffer: ArrayBuffer; type: string } | null>(
      (resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readonly')
        const req = tx.objectStore(DB_STORE).get(id)
        req.onsuccess = () => resolve(req.result ?? null)
        req.onerror = () => reject(req.error)
      },
    )
    db.close()
    if (!record) return null
    return new Blob([record.buffer], { type: record.type })
  }

  async deleteArtifactBlob(id: string): Promise<void> {
    const db = await this.openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite')
      tx.objectStore(DB_STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }

  // ---- account ----
  async deleteAllData(): Promise<void> {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(ROOT_KEY)
    const db = await this.openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite')
      tx.objectStore(DB_STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }
}
