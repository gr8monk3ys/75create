// The day's log while it's being written: what's typed, what's waiting to be
// saved, and what to do when storage changes underneath it. Every rule for
// "never lose a log" lives here, with timers injected, so it's tested without
// a browser; the check-in card only wires it to its textarea and page events.

export interface Timers {
  set(fn: () => void, ms: number): unknown
  clear(id: unknown): void
}

const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
}

export interface LogDraft {
  /** The person typed. Returns the text to show (clipped); the save waits for a pause. */
  type(value: string): string
  /**
   * Storage now holds `value` (a sync from another device, another tab).
   * Returns the text to show instead, or null to keep what's on screen: this
   * draft's own saves coming back, or typing that hasn't been saved yet (it
   * wins, and saves next).
   */
  stored(value: string): string | null
  /** Save any pending text now: the page is hiding, or the card is going. */
  flush(): void
  /** A last flush, then no more timers. */
  dispose(): void
}

export function createLogDraft(options: {
  initial: string
  maxChars: number
  /** How long typing pauses before it's saved. */
  delayMs: number
  save: (text: string) => void
  /** After a save that the pause (not a flush) triggered. */
  onSaved?: () => void
  timers?: Timers
}): LogDraft {
  const { maxChars, delayMs, save, onSaved, timers = realTimers } = options
  let known = options.initial
  let pending: string | null = null
  let timer: unknown = null

  function write(): boolean {
    if (pending === null) return false
    const text = pending
    pending = null
    known = text
    save(text)
    return true
  }

  function stop() {
    if (timer !== null) timers.clear(timer)
    timer = null
  }

  return {
    type(value) {
      const text = value.slice(0, maxChars)
      pending = text
      stop()
      timer = timers.set(() => {
        timer = null
        if (write()) onSaved?.()
      }, delayMs)
      return text
    },
    stored(value) {
      if (value === known) return null
      known = value
      return pending === null ? value : null
    },
    flush() {
      stop()
      write()
    },
    dispose() {
      stop()
      write()
    },
  }
}

export interface MomentHold {
  /** The day was just made by the log, mid-sentence: wait for a pause. */
  hold(): void
  /** Still typing: the pause starts again. */
  typing(): void
  /** They paused or left the field: play the moment now, if one is held. */
  release(): void
  /** The day came back off the grid: nothing to celebrate any more. */
  cancel(): void
}

/**
 * Holds the day's celebration while the person is still writing the log that
 * completed it, so the full-screen moment never lands on a half-written
 * sentence. It plays on the first pause of `pauseMs`, or when they leave.
 */
export function createMomentHold(options: {
  pauseMs: number
  play: () => void
  timers?: Timers
}): MomentHold {
  const { pauseMs, play, timers = realTimers } = options
  let held = false
  let timer: unknown = null

  function stop() {
    if (timer !== null) timers.clear(timer)
    timer = null
  }
  function release() {
    stop()
    if (!held) return
    held = false
    play()
  }
  function wait() {
    stop()
    timer = timers.set(release, pauseMs)
  }

  return {
    hold() {
      held = true
      wait()
    },
    typing() {
      if (held) wait()
    },
    release,
    cancel() {
      held = false
      stop()
    },
  }
}
