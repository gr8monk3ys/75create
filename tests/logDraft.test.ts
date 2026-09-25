import { describe, it, expect, beforeEach } from 'bun:test'
import { Timers, createLogDraft, createMomentHold } from '@/lib/logDraft'

/** A clock the test moves by hand. */
function fakeTimers() {
  let now = 0
  let seq = 0
  const queue = new Map<number, { at: number; fn: () => void }>()
  const timers: Timers = {
    set(fn, ms) {
      const id = ++seq
      queue.set(id, { at: now + ms, fn })
      return id
    },
    clear(id) {
      queue.delete(id as number)
    },
  }
  function advance(ms: number) {
    now += ms
    for (const [id, t] of [...queue].sort((a, b) => a[1].at - b[1].at)) {
      if (t.at <= now && queue.has(id)) {
        queue.delete(id)
        t.fn()
      }
    }
  }
  return { timers, advance }
}

describe('createLogDraft', () => {
  let clock: ReturnType<typeof fakeTimers>
  let saved: string[]
  let flashes: number
  const make = (initial = '') =>
    createLogDraft({
      initial,
      maxChars: 10,
      delayMs: 600,
      save: (t) => saved.push(t),
      onSaved: () => flashes++,
      timers: clock.timers,
    })

  beforeEach(() => {
    clock = fakeTimers()
    saved = []
    flashes = 0
  })

  it('saves once, after typing pauses, clipped to the limit', () => {
    const d = make()
    expect(d.type('abc')).toBe('abc')
    clock.advance(300)
    d.type('abcdefghijklmn')
    clock.advance(599)
    expect(saved).toEqual([])
    clock.advance(1)
    expect(saved).toEqual(['abcdefghij'])
    expect(flashes).toBe(1)
  })

  it('flushes pending text at once when the page hides, and only once', () => {
    const d = make()
    d.type('harbour')
    d.flush()
    expect(saved).toEqual(['harbour'])
    clock.advance(1000)
    d.flush()
    expect(saved).toEqual(['harbour'])
    expect(flashes).toBe(0)
  })

  it('saves what was typed when the card goes away', () => {
    const d = make()
    d.type('typed then left')
    d.dispose()
    expect(saved).toEqual(['typed then l'.slice(0, 10)])
  })

  it('ignores its own saves coming back from storage', () => {
    const d = make()
    d.type('mine')
    clock.advance(600)
    expect(d.stored('mine')).toBeNull()
  })

  it('takes in a log written elsewhere when nothing is pending', () => {
    const d = make('first')
    expect(d.stored('from laptop')).toBe('from laptop')
  })

  it('keeps unsaved typing over a remote log, then saves it', () => {
    const d = make('first')
    d.type('typing here')
    expect(d.stored('from laptop')).toBeNull()
    clock.advance(600)
    expect(saved).toEqual(['typing her'])
  })
})

describe('createMomentHold', () => {
  it('plays after a pause, and each keystroke restarts the pause', () => {
    const clock = fakeTimers()
    let played = 0
    const h = createMomentHold({ pauseMs: 1500, play: () => played++, timers: clock.timers })
    h.hold()
    clock.advance(1000)
    h.typing()
    clock.advance(1000)
    expect(played).toBe(0)
    clock.advance(500)
    expect(played).toBe(1)
    clock.advance(5000)
    expect(played).toBe(1)
  })

  it('plays at once on release, and never after a cancel', () => {
    const clock = fakeTimers()
    let played = 0
    const h = createMomentHold({ pauseMs: 1500, play: () => played++, timers: clock.timers })
    h.release()
    expect(played).toBe(0) // nothing held
    h.hold()
    h.release()
    expect(played).toBe(1)
    h.hold()
    h.cancel()
    clock.advance(5000)
    h.release()
    expect(played).toBe(1)
  })
})
