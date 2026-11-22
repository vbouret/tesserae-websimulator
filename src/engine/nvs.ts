/** What the screen shows. Persisted so a reload looks like an e-ink panel that kept its image. */
export type DisplayState =
  | { kind: 'blank' }
  | { kind: 'splash'; title: string; lines: string[] }
  | { kind: 'frame'; bytes: Uint8Array; renderId?: string }

export interface DeviceConfig {
  sleep_interval_s: number
  button_wake_s?: number
  beep_enabled?: boolean
  beep_volume?: number
  beep_pattern?: string
  always_on?: boolean
  awake_poll_s?: number
}

/** Mirror of what the firmware keeps in NVS. */
export interface NvsData {
  mac: string
  ssid?: string
  server_url?: string
  onboarding: 'discover' | 'pairing'
  pairing_code?: string
  device_id?: string
  device_token?: string
  last_frame_etag?: string
  tz?: string
  config: DeviceConfig
  display: DisplayState
  /** Absolute epoch ms of the next scheduled wake. */
  wake_at?: number
}

export const DEFAULT_SLEEP_S = 300

export const newNvs = (mac: string): NvsData => ({
  mac,
  onboarding: 'discover',
  config: { sleep_interval_s: DEFAULT_SLEEP_S },
  display: { kind: 'blank' },
})

export class Nvs {
  private listeners = new Set<(d: NvsData) => void>()
  constructor(private data: NvsData) {}
  get(): NvsData {
    return this.data
  }
  patch(p: Partial<NvsData>) {
    this.data = { ...this.data, ...p }
    this.emit()
  }
  /** Wipe everything except the MAC, like a factory reset. */
  reset() {
    this.data = newNvs(this.data.mac)
    this.emit()
  }
  subscribe(fn: (d: NvsData) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private emit() {
    this.listeners.forEach((l) => l(this.data))
  }
}

/** Stable fake MAC (locally administered) from a seed string. */
export function fakeMac(seed: string): string {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const b = [0x02, 0x7e, (h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255]
  return b.map((x) => x.toString(16).padStart(2, '0')).join(':')
}
