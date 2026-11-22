/** Time source. The engine never touches Date.now / setTimeout directly. */
export interface Clock {
  now(): number
  /** Resolves after `ms`, or early (without error) when `signal` aborts. */
  sleep(ms: number, signal?: AbortSignal): Promise<void>
}

/**
 * Real time. Sleeps are polled against the wall clock (not one long setTimeout), so a throttled
 * background tab or a suspended laptop catches up on the next tick instead of drifting.
 */
export class RealClock implements Clock {
  now() {
    return Date.now()
  }
  async sleep(ms: number, signal?: AbortSignal) {
    const target = Date.now() + ms
    while (!signal?.aborted) {
      const left = target - Date.now()
      if (left <= 0) return
      await new Promise<void>((resolve) => {
        const t = setTimeout(done, Math.min(left, 500))
        function done() {
          clearTimeout(t)
          signal?.removeEventListener('abort', done)
          resolve()
        }
        signal?.addEventListener('abort', done, { once: true })
      })
    }
  }
}

/** Deterministic clock for tests: sleeping just advances time. */
export class FakeClock implements Clock {
  constructor(public t = 1_700_000_000_000) {}
  now() {
    return this.t
  }
  async sleep(ms: number, signal?: AbortSignal) {
    if (signal?.aborted) return
    this.t += ms
  }
  advance(ms: number) {
    this.t += ms
  }
}
