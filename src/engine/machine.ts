import type { Clock } from './clock'
import { HttpError, type Http } from './http'
import { DEFAULT_SLEEP_S, type DisplayState, type Nvs } from './nvs'
import { pickConfig, TesseraeClient, type Identity, type StatusBody } from './rest'
import { frameBytesFor, type DeviceProfile } from '@/profiles'

export const FW_VERSION = 'sim-0.1.0'
const ERROR_RETRY_S = 60

export type WifiMode = 'ok' | 'fail' | 'outage'

/** The simulated hardware's live, user-editable state. */
export interface SimSettings {
  batteryPct: number
  batteryMv: number
  vbus: boolean
  charging: boolean
  rssi: number
  temperatureC: number
  humidityPct: number
  wifi: WifiMode
  /** Optional % lost per wake cycle (0 = off). */
  drainPerCycle: number
}

export const defaultSettings = (): SimSettings => ({
  batteryPct: 87,
  batteryMv: 4020,
  vbus: false,
  charging: false,
  rssi: -58,
  temperatureC: 22.4,
  humidityPct: 41,
  wifi: 'ok',
  drainPerCycle: 0,
})

export type WakeReason = 'boot' | 'timer' | 'manual' | 'button' | 'config'

export type EngineState =
  | 'idle'
  | 'setup'
  | 'connecting'
  | 'onboarding'
  | 'fetching'
  | 'reporting'
  | 'painting'
  | 'sleeping'

export type EngineEvent =
  | { type: 'state'; state: EngineState; note?: string }
  | { type: 'display'; display: DisplayState; refresh: boolean }
  | { type: 'led'; on: boolean }
  | { type: 'beep'; pattern: string; volume: number }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }

export interface CycleResult {
  /** Seconds to sleep, or null to wait for the user (setup needed). */
  sleepS: number | null
  outcome: string
}

export interface EngineDeps {
  profile: DeviceProfile
  clock: Clock
  http: Http
  nvs: Nvs
  settings: () => SimSettings
  emit: (e: EngineEvent) => void
  /** Simulated durations. Tests pass zeros. */
  timing?: { wifiConnectMs: number; paintMs: number }
}

type OnboardResult = { ok: true } | { ok: false; result: CycleResult }

export class FirmwareEngine {
  private pendingButton: { name: string; id: number } | null = null
  private buttonSeq = 0
  private t: { wifiConnectMs: number; paintMs: number }

  constructor(private d: EngineDeps) {
    this.t = d.timing ?? { wifiConnectMs: 800, paintMs: 3500 }
  }

  /** A front-button press. It is delivered on the next frame GET (or the status fallback). */
  pressButton(name: string) {
    this.pendingButton = { name, id: ++this.buttonSeq }
  }

  private log(level: 'info' | 'warn' | 'error', message: string) {
    this.d.emit({ type: 'log', level, message })
  }
  private state(state: EngineState, note?: string) {
    this.d.emit({ type: 'state', state, note })
  }
  private splash(title: string, lines: string[] = []) {
    const display: DisplayState = { kind: 'splash', title, lines }
    this.d.nvs.patch({ display })
    this.d.emit({ type: 'display', display, refresh: true })
  }

  private identity(): Identity {
    const nv = this.d.nvs.get()
    const p = this.d.profile
    const suffix = nv.mac.replace(/:/g, '').slice(-6).toUpperCase()
    return {
      device_id: nv.device_id ?? `${p.idPrefix}_${suffix}`,
      kind: p.kind,
      panel_w: p.panelW,
      panel_h: p.panelH,
      rotation: p.rotation,
      fw_version: FW_VERSION,
      mac: nv.mac,
    }
  }

  /** One full wake cycle. Never throws. */
  async cycle(reason: WakeReason): Promise<CycleResult> {
    try {
      return await this.run(reason)
    } catch (e) {
      const msg = e instanceof HttpError ? e.message : (e as Error).message
      this.log('error', msg)
      const hint =
        e instanceof HttpError && e.kind === 'mixed-content'
          ? ['HTTPS page cannot reach an', 'HTTP server (mixed content).']
          : [this.d.nvs.get().server_url ?? '', 'Will retry shortly.']
      this.splash("Can't reach the server", hint)
      return { sleepS: ERROR_RETRY_S, outcome: 'unreachable' }
    }
  }

  private async run(reason: WakeReason): Promise<CycleResult> {
    const { nvs, clock } = this.d
    this.log('info', `Wake (${reason})`)
    this.state('idle', 'boot')
    let nv = nvs.get()

    if (!nv.ssid || !nv.server_url) {
      this.state('setup')
      this.splash('Setup needed', ['Enter Wi-Fi and the Tesserae', 'server URL in the setup form.'])
      return { sleepS: null, outcome: 'setup-needed' }
    }

    this.state('connecting', nv.ssid)
    await clock.sleep(this.t.wifiConnectMs)
    const wifi = this.d.settings().wifi
    if (wifi !== 'ok') {
      this.splash(wifi === 'fail' ? "Wi-Fi didn't connect" : 'Wi-Fi unavailable', [
        `Network: ${nv.ssid}`,
        'Will retry.',
      ])
      return { sleepS: ERROR_RETRY_S, outcome: `wifi-${wifi}` }
    }

    const client = new TesseraeClient(this.d.http, nv.server_url)

    for (let attempt = 0; attempt < 2; attempt++) {
      nv = nvs.get()
      if (!nv.device_token) {
        const r = await this.onboard(client)
        if (!r.ok) return r.result
      }
      const out = await this.fetchAndReport(client)
      if (out) return out
      // 401: token was revoked, re-onboard once.
      this.log('warn', 'Token rejected (401); re-onboarding')
      nvs.patch({ device_token: undefined, last_frame_etag: undefined })
    }
    return { sleepS: ERROR_RETRY_S, outcome: 'unauthorized' }
  }

  private async onboard(client: TesseraeClient): Promise<OnboardResult> {
    const { nvs } = this.d
    const nv = nvs.get()
    this.state('onboarding', nv.onboarding)
    const id = this.identity()

    let res, body
    if (nv.onboarding === 'pairing') {
      ;({ res, body } = await client.register(id, nv.pairing_code ?? ''))
    } else {
      ;({ res, body } = await client.discover(id))
    }

    if (res.status === 429) {
      const wait = (body?.retry_after_s as number | undefined) ?? ERROR_RETRY_S
      this.splash('Tesserae is busy', ['It will keep retrying.'])
      return { ok: false, result: { sleepS: wait, outcome: 'busy' } }
    }
    if (nv.onboarding === 'pairing' && res.status >= 400 && res.status < 500) {
      this.splash('Pairing code rejected', ['Check the code in', 'Tesserae, Settings > Devices.'])
      return { ok: false, result: { sleepS: ERROR_RETRY_S, outcome: 'pairing-rejected' } }
    }
    if (res.status >= 300) {
      this.log('error', `Onboarding failed: HTTP ${res.status}`)
      this.splash("Can't reach the server", [`HTTP ${res.status} from ${nv.server_url}`])
      return { ok: false, result: { sleepS: ERROR_RETRY_S, outcome: 'onboard-error' } }
    }

    const token = body?.device_token as string | undefined
    if (nv.onboarding === 'discover' && (!body?.registered || !token)) {
      this.splash('Almost done', ['Approve this device in Tesserae,', 'Settings > Devices.'])
      const wait = (body?.retry_after_s as number | undefined) ?? 30
      return { ok: false, result: { sleepS: wait, outcome: 'pending-approval' } }
    }
    if (!token) {
      this.splash("Can't reach the server", ['Registration returned no token.'])
      return { ok: false, result: { sleepS: ERROR_RETRY_S, outcome: 'no-token' } }
    }

    const cfg = pickConfig(body?.config)
    nvs.patch({
      device_token: token,
      device_id: (body?.device_id as string | undefined) ?? id.device_id,
      config: { ...nv.config, ...cfg },
      tz: cfg.tz ?? nv.tz,
    })
    this.log('info', `Onboarded as ${nvs.get().device_id}`)
    return { ok: true }
  }

  /** Returns null when the server answered 401 (caller re-onboards). */
  private async fetchAndReport(client: TesseraeClient): Promise<CycleResult | null> {
    const { nvs, profile } = this.d
    const nv = nvs.get()
    const deviceId = nv.device_id!
    const token = nv.device_token!

    this.state('fetching')
    const sending = this.pendingButton
    const fr = await client.frame(deviceId, token, nv.last_frame_etag, sending ?? undefined)
    if (fr.kind === 'unauthorized') return null

    const delivered = fr.kind === 'frame' || fr.kind === 'not-modified' || fr.kind === 'no-content'
    if (sending && delivered) this.pendingButton = null

    if (fr.kind === 'busy') {
      this.splash('Tesserae is busy', ['It will keep retrying.'])
      return { sleepS: fr.retryAfterS ?? ERROR_RETRY_S, outcome: 'busy' }
    }

    let newFrame: { bytes: Uint8Array; renderId?: string; etag?: string } | null = null
    let outcome = 'ok'

    if (fr.kind === 'frame') {
      if (fr.buttonWakeS !== undefined)
        nvs.patch({ config: { ...nvs.get().config, button_wake_s: fr.buttonWakeS } })
      const expected = frameBytesFor(profile)
      const bin = await client.fetchBin(fr.url, token)
      if (bin.status !== 200) {
        this.log('error', `Frame download failed: HTTP ${bin.status}`)
        outcome = 'bin-http-error'
      } else if (bin.body.length !== expected) {
        this.log('error', `Frame is ${bin.body.length} B, expected exactly ${expected} B`)
        outcome = 'bin-wrong-length'
      } else {
        if (!fr.etag)
          this.log('warn', 'No ETag visible (CORS Expose-Headers?); cannot cache frames')
        newFrame = { bytes: bin.body, renderId: fr.renderId, etag: fr.etag }
      }
    } else if (fr.kind === 'error') {
      this.log('error', fr.message)
      outcome = 'frame-error'
    } else if (fr.kind === 'no-content') {
      outcome = 'no-frame-yet'
    } else {
      outcome = 'not-modified'
    }

    // Report status.
    this.state('reporting')
    const sleepGuess = nvs.get().config.sleep_interval_s || DEFAULT_SLEEP_S
    let sleepS = sleepGuess
    const body = this.statusBody(sleepGuess, this.pendingButton)
    try {
      const { res, body: sb } = await client.status(deviceId, token, body)
      if (res.status === 401) return null
      if (res.status === 200 || res.status === 204) {
        if (this.pendingButton && !delivered) this.pendingButton = null
        const cfg = pickConfig(sb?.config)
        const { tz, ...rest } = cfg
        nvs.patch({ config: { ...nvs.get().config, ...rest }, tz: tz ?? nvs.get().tz })
        const next = sb?.next_poll_s
        if (typeof next === 'number' && next > 0) sleepS = next
        else sleepS = nvs.get().config.sleep_interval_s || DEFAULT_SLEEP_S
      } else {
        this.log('warn', `Status POST returned HTTP ${res.status}`)
      }
    } catch (e) {
      if (!(e instanceof HttpError)) throw e
      this.log('warn', `Status POST failed: ${e.message}`)
    }

    // Paint.
    if (newFrame) {
      this.state('painting')
      const display: DisplayState = {
        kind: 'frame',
        bytes: newFrame.bytes,
        renderId: newFrame.renderId,
      }
      this.d.emit({ type: 'display', display, refresh: true })
      this.d.emit({ type: 'led', on: true })
      await this.d.clock.sleep(this.t.paintMs)
      this.d.emit({ type: 'led', on: false })
      nvs.patch({ display, last_frame_etag: newFrame.etag })
      const cfg = nvs.get().config
      if (cfg.beep_enabled && cfg.beep_pattern)
        this.d.emit({ type: 'beep', pattern: cfg.beep_pattern, volume: cfg.beep_volume ?? 50 })
      outcome = 'painted'
    } else if (fr.kind === 'no-content') {
      this.splash('Connected!', ['Waiting for your first frame.'])
    }

    return { sleepS, outcome }
  }

  private statusBody(sleepS: number, button: { name: string; id: number } | null): StatusBody {
    const { nvs, profile, clock } = this.d
    const nv = nvs.get()
    const s = this.d.settings()
    const body: StatusBody = {
      battery_mv: s.batteryMv,
      battery_pct: s.batteryPct,
      vbus: s.vbus,
      charging: s.charging,
      rssi: s.rssi,
      ip: '192.168.1.' + (100 + (parseInt(nv.mac.slice(-2), 16) % 100)),
      next_sleep_s: sleepS,
      sleep_until: Math.floor(clock.now() / 1000) + sleepS,
      fw_version: FW_VERSION,
      panel_w: profile.panelW,
      panel_h: profile.panelH,
    }
    if (profile.envSensor) {
      body.temperature_c = s.temperatureC
      body.humidity_pct = s.humidityPct
      body.env_sensor = profile.envSensor
    }
    if (nv.tz) body.tz = nv.tz
    if (button) {
      body.button = button.name
      body.button_event_id = button.id
    }
    return body
  }
}
