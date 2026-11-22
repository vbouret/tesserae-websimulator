import { HttpError, jsonOf, type Http, type HttpResponse } from './http'
import type { DeviceConfig } from './nvs'

export interface Identity {
  device_id: string
  kind: string
  panel_w: number
  panel_h: number
  rotation: number
  fw_version: string
  mac: string
}

export interface StatusBody {
  battery_mv: number
  battery_pct: number
  vbus: boolean
  charging: boolean
  rssi: number
  ip: string
  next_sleep_s: number
  sleep_until: number
  fw_version: string
  panel_w: number
  panel_h: number
  temperature_c?: number
  humidity_pct?: number
  env_sensor?: string
  tz?: string
  button?: string
  button_event_id?: number
}

interface Json {
  [k: string]: unknown
}

export type FrameResult =
  | {
      kind: 'frame'
      url: string
      format?: string
      panelW?: number
      panelH?: number
      renderId?: string
      etag?: string
      buttonWakeS?: number
    }
  | { kind: 'not-modified' }
  | { kind: 'no-content' }
  | { kind: 'unauthorized' }
  | { kind: 'busy'; retryAfterS?: number }
  | { kind: 'error'; status: number; message: string }

const asNum = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)
const asStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

export function pickConfig(c: unknown): Partial<DeviceConfig> & { tz?: string } {
  const o = (c ?? {}) as Json
  const out: Partial<DeviceConfig> & { tz?: string } = {}
  if (asNum(o.sleep_interval_s) !== undefined) out.sleep_interval_s = o.sleep_interval_s as number
  if (asNum(o.button_wake_s) !== undefined) out.button_wake_s = o.button_wake_s as number
  if (typeof o.beep_enabled === 'boolean') out.beep_enabled = o.beep_enabled
  if (asNum(o.beep_volume) !== undefined) out.beep_volume = o.beep_volume as number
  if (asStr(o.beep_pattern) !== undefined) out.beep_pattern = o.beep_pattern as string
  if (typeof o.always_on === 'boolean') out.always_on = o.always_on
  if (asNum(o.awake_poll_s) !== undefined) out.awake_poll_s = o.awake_poll_s as number
  if (asStr(o.tz) !== undefined) out.tz = o.tz as string
  return out
}

const retryAfter = (res: HttpResponse): number | undefined => {
  const body = jsonOf<Json>(res)
  return asNum(body?.retry_after_s) ?? (Number(res.headers['retry-after']) || undefined)
}

/** Typed client for `<server_url>/api/v1/device/`. Network failures throw HttpError. */
export class TesseraeClient {
  readonly base: string
  constructor(
    private http: Http,
    serverUrl: string,
  ) {
    this.base = serverUrl.replace(/\/+$/, '') + '/api/v1/device'
  }

  private json(h: Record<string, string> = {}) {
    return { 'Content-Type': 'application/json', Accept: 'application/json', ...h }
  }

  async discover(identity: Identity) {
    const res = await this.http.request({
      method: 'POST',
      url: `${this.base}/discover`,
      headers: this.json(),
      body: JSON.stringify(identity),
    })
    return { res, body: jsonOf<Json>(res) }
  }

  async register(identity: Identity, pairingCode: string) {
    const res = await this.http.request({
      method: 'POST',
      url: `${this.base}/register`,
      headers: this.json({ 'X-Pairing-Code': pairingCode }),
      body: JSON.stringify(identity),
    })
    return { res, body: jsonOf<Json>(res) }
  }

  async frame(
    deviceId: string,
    token: string,
    etag?: string,
    button?: { name: string; id: number },
  ): Promise<FrameResult> {
    const q = button
      ? `?button=${encodeURIComponent(button.name)}&button_event_id=${button.id}`
      : ''
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    if (etag) headers['If-None-Match'] = etag
    const res = await this.http.request({
      method: 'GET',
      url: `${this.base}/${encodeURIComponent(deviceId)}/frame${q}`,
      headers,
    })
    if (res.status === 304) return { kind: 'not-modified' }
    if (res.status === 204) return { kind: 'no-content' }
    if (res.status === 401 || res.status === 403) return { kind: 'unauthorized' }
    if (res.status === 429) return { kind: 'busy', retryAfterS: retryAfter(res) }
    if (res.status === 200) {
      const b = jsonOf<Json>(res)
      const url = asStr(b?.url)
      if (!url) return { kind: 'error', status: 200, message: 'Frame response has no url' }
      return {
        kind: 'frame',
        url: new URL(url, this.base + '/').toString(),
        format: asStr(b?.format),
        panelW: asNum(b?.panel_w),
        panelH: asNum(b?.panel_h),
        renderId: b?.render_id !== undefined ? String(b.render_id) : undefined,
        etag: res.headers['etag'],
        buttonWakeS: asNum(b?.button_wake_s),
      }
    }
    return { kind: 'error', status: res.status, message: `Unexpected HTTP ${res.status}` }
  }

  /**
   * Download the panel-native .bin. Tries without Authorization first (a simple CORS GET needs no
   * preflight; the URL is signed), then retries with the bearer token if the server insists.
   */
  async fetchBin(url: string, token: string): Promise<HttpResponse> {
    const plain = await this.http.request({ method: 'GET', url }).catch((e) => {
      if (e instanceof HttpError && e.kind === 'mixed-content') throw e
      return null
    })
    if (plain && plain.status === 200) return plain
    return this.http.request({ method: 'GET', url, headers: { Authorization: `Bearer ${token}` } })
  }

  async status(deviceId: string, token: string, body: StatusBody) {
    const res = await this.http.request({
      method: 'POST',
      url: `${this.base}/${encodeURIComponent(deviceId)}/status`,
      headers: this.json({ Authorization: `Bearer ${token}` }),
      body: JSON.stringify(body),
    })
    return { res, body: jsonOf<Json>(res) }
  }
}
