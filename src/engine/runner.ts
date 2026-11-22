import type { Clock } from './clock'
import type { CycleResult, FirmwareEngine, WakeReason } from './machine'
import type { Nvs } from './nvs'

export interface RunnerHooks {
  onSleep(wakeAt: number | null, result: CycleResult): void
  onCycleEnd?(result: CycleResult): void
}

/**
 * Drives one virtual device: cycle -> sleep until wake_at (or a wake signal) -> cycle ...
 * wake_at is absolute and persisted, so a reload resumes the same sleep, and a long-suspended
 * tab performs one catch-up wake rather than N.
 */
export class Runner {
  private running = false
  private abort: AbortController | null = null
  private wakeReason: WakeReason | null = null
  private busy = false
  speed = 1

  constructor(
    private engine: FirmwareEngine,
    private clock: Clock,
    private nvs: Nvs,
    private hooks: RunnerHooks,
  ) {}

  get isBusy() {
    return this.busy
  }

  start() {
    if (this.running) return
    this.running = true
    void this.loop()
  }

  stop() {
    this.running = false
    this.abort?.abort()
  }

  /** Wake the device (Wake now / button / settings changed). Ignored mid-cycle. */
  wake(reason: WakeReason) {
    if (this.busy) return
    this.wakeReason = reason
    this.abort?.abort()
  }

  private async loop() {
    let reason: WakeReason = 'boot'
    let first = true
    while (this.running) {
      const savedWake = this.nvs.get().wake_at
      let wakeAt: number | null

      if (first && savedWake && savedWake > this.clock.now()) {
        wakeAt = savedWake // resume the sleep that was in progress before the reload
        this.hooks.onSleep(wakeAt, {
          sleepS: (wakeAt - this.clock.now()) / 1000,
          outcome: 'resumed',
        })
        reason = 'timer'
      } else {
        this.busy = true
        const result = await this.engine.cycle(reason)
        this.busy = false
        wakeAt =
          result.sleepS == null ? null : this.clock.now() + (result.sleepS * 1000) / this.speed
        this.nvs.patch({ wake_at: wakeAt ?? undefined })
        this.hooks.onCycleEnd?.(result)
        this.hooks.onSleep(wakeAt, result)
      }
      first = false

      reason = await this.waitForWake(wakeAt)
    }
  }

  private async waitForWake(wakeAt: number | null): Promise<WakeReason> {
    this.wakeReason = null
    this.abort = new AbortController()
    const { signal } = this.abort
    if (wakeAt == null) {
      await new Promise<void>((r) => signal.addEventListener('abort', () => r(), { once: true }))
    } else {
      await this.clock.sleep(Math.max(0, wakeAt - this.clock.now()), signal)
    }
    return this.wakeReason ?? 'timer'
  }
}
