import { describe, expect, it } from 'vitest'
import { FakeClock } from './clock'
import { HttpError, type Http, type HttpRequest, type HttpResponse } from './http'
import { FirmwareEngine, defaultSettings, type EngineEvent, type SimSettings } from './machine'
import { Nvs, fakeMac, newNvs } from './nvs'
import { Runner } from './runner'
import { e1001 } from '@/profiles/seeed-reterminal-e1001'
import { e1001Gray } from '@/profiles/seeed-reterminal-e1001-gray'
import type { DeviceProfile } from '@/profiles'

type Handler = (req: HttpRequest) => (Partial<HttpResponse> & { json?: unknown }) | Error

class ScriptedHttp implements Http {
  calls: HttpRequest[] = []
  constructor(public handler: Handler) {}
  async request(req: HttpRequest): Promise<HttpResponse> {
    this.calls.push(req)
    const r = this.handler(req)
    if (r instanceof Error) throw r
    const body =
      r.json !== undefined
        ? new TextEncoder().encode(JSON.stringify(r.json))
        : (r.body ?? new Uint8Array())
    return { status: r.status ?? 200, headers: r.headers ?? {}, body }
  }
  find(re: RegExp) {
    return this.calls.filter((c) => re.test(`${c.method} ${c.url}`))
  }
}

const S = 'http://tess:8765'
const bin = (n: number) => new Uint8Array(n).fill(0xaa)

function setup(
  handler: Handler,
  opts: { profile?: DeviceProfile; configured?: boolean; settings?: Partial<SimSettings> } = {},
) {
  const profile = opts.profile ?? e1001
  const nvs = new Nvs({
    ...newNvs(fakeMac('t')),
    ...(opts.configured === false ? {} : { ssid: 'home', server_url: S }),
  })
  const http = new ScriptedHttp(handler)
  const clock = new FakeClock()
  const events: EngineEvent[] = []
  const settings = { ...defaultSettings(), ...opts.settings }
  const engine = new FirmwareEngine({
    profile,
    clock,
    http,
    nvs,
    settings: () => settings,
    emit: (e) => events.push(e),
    timing: { wifiConnectMs: 0, paintMs: 0 },
  })
  return { engine, nvs, http, clock, events }
}

const happy =
  (frameLen = 48000, extra: Partial<Record<string, unknown>> = {}): Handler =>
  (req) => {
    if (req.url.endsWith('/discover'))
      return {
        json: {
          registered: true,
          device_token: 'tok12345',
          device_id: 'dev1',
          config: { sleep_interval_s: 600 },
        },
      }
    if (req.url.includes('/frame'))
      return { json: { url: `${S}/renders/a.bin`, render_id: 'r1' }, headers: { etag: '"e1"' } }
    if (req.url.endsWith('.bin')) return { body: bin(frameLen) }
    if (req.url.endsWith('/status'))
      return { json: { next_poll_s: 123, config: { sleep_interval_s: 600, ...extra } } }
    return { status: 404 }
  }

describe('wake cycle', () => {
  it('shows the setup screen when unconfigured', async () => {
    const t = setup(happy(), { configured: false })
    const r = await t.engine.cycle('boot')
    expect(r).toEqual({ sleepS: null, outcome: 'setup-needed' })
    expect(t.http.calls).toHaveLength(0)
    expect(t.nvs.get().display).toMatchObject({ kind: 'splash', title: 'Setup needed' })
  })

  it('onboards, fetches, reports, paints, sleeps for next_poll_s', async () => {
    const t = setup(happy())
    const r = await t.engine.cycle('boot')
    expect(r).toEqual({ sleepS: 123, outcome: 'painted' })
    const nv = t.nvs.get()
    expect(nv.device_token).toBe('tok12345')
    expect(nv.last_frame_etag).toBe('"e1"')
    expect(nv.display.kind).toBe('frame')
    const order = t.http.calls.map((c) => c.url.replace(S, ''))
    expect(order).toEqual([
      '/api/v1/device/discover',
      '/api/v1/device/dev1/frame',
      '/renders/a.bin',
      '/api/v1/device/dev1/status',
    ])
    const status = JSON.parse(t.http.calls[3].body!)
    expect(status).toMatchObject({
      panel_w: 800,
      panel_h: 480,
      env_sensor: 'sht4x',
      next_sleep_s: 600,
    })
    expect(t.http.calls[1].headers!.Authorization).toBe('Bearer tok12345')
  })

  it('sends the E1001 identity on discover', async () => {
    const t = setup(happy(), { profile: e1001Gray })
    await t.engine.cycle('boot')
    expect(JSON.parse(t.http.calls[0].body!)).toMatchObject({
      kind: 'seeed_reterminal_e1001_gray',
      panel_w: 800,
      panel_h: 480,
      rotation: 0,
    })
  })

  it('registers with the pairing code header', async () => {
    const t = setup((req) =>
      req.url.endsWith('/register')
        ? { json: { device_token: 'T', device_id: 'd' } }
        : happy()(req),
    )
    t.nvs.patch({ onboarding: 'pairing', pairing_code: '123-456' })
    await t.engine.cycle('boot')
    const reg = t.http.find(/register/)[0]
    expect(reg.headers!['X-Pairing-Code']).toBe('123-456')
  })

  it('reports a rejected pairing code', async () => {
    const t = setup(() => ({ status: 403 }))
    t.nvs.patch({ onboarding: 'pairing', pairing_code: 'bad' })
    const r = await t.engine.cycle('boot')
    expect(r.outcome).toBe('pairing-rejected')
    expect(t.nvs.get().display).toMatchObject({ title: 'Pairing code rejected' })
  })

  it('waits for approval when discover is not yet registered', async () => {
    const t = setup(() => ({ json: { registered: false, retry_after_s: 42 } }))
    const r = await t.engine.cycle('boot')
    expect(r).toEqual({ sleepS: 42, outcome: 'pending-approval' })
    expect(t.nvs.get().display).toMatchObject({ title: 'Almost done' })
  })

  it('honours 429 retry_after_s while onboarding', async () => {
    const t = setup(() => ({ status: 429, json: { retry_after_s: 90 } }))
    expect(await t.engine.cycle('boot')).toEqual({ sleepS: 90, outcome: 'busy' })
  })

  it('sends If-None-Match and skips painting on 304', async () => {
    const t = setup(happy())
    await t.engine.cycle('boot')
    t.http.calls.length = 0
    const inner = t.http.handler
    t.http.handler = (req) => (req.url.includes('/frame') ? { status: 304 } : inner(req))
    const r = await t.engine.cycle('timer')
    expect(r.outcome).toBe('not-modified')
    expect(t.http.calls[0].headers!['If-None-Match']).toBe('"e1"')
    expect(t.http.find(/\.bin/)).toHaveLength(0)
    expect(t.http.find(/status/)).toHaveLength(1)
  })

  it('204 shows the waiting-for-first-frame screen', async () => {
    const t = setup((req) => (req.url.includes('/frame') ? { status: 204 } : happy()(req)))
    const r = await t.engine.cycle('boot')
    expect(r.outcome).toBe('no-frame-yet')
    expect(t.nvs.get().display).toMatchObject({ kind: 'splash', title: 'Connected!' })
  })

  it('rejects a .bin of the wrong length and keeps the old image', async () => {
    const t = setup(happy(47999))
    const r = await t.engine.cycle('boot')
    expect(r.outcome).toBe('bin-wrong-length')
    expect(t.nvs.get().display.kind).not.toBe('frame')
    expect(t.nvs.get().last_frame_etag).toBeUndefined()
    expect(t.http.find(/status/)).toHaveLength(1)
  })

  it('wants 96000 bytes for the gray profile', async () => {
    const ok = setup(happy(96000), { profile: e1001Gray })
    expect((await ok.engine.cycle('boot')).outcome).toBe('painted')
    const bad = setup(happy(48000), { profile: e1001Gray })
    expect((await bad.engine.cycle('boot')).outcome).toBe('bin-wrong-length')
  })

  it('re-onboards after a 401 (token revoked)', async () => {
    let revoked = true
    const t = setup((req) => {
      if (req.url.includes('/frame') && revoked && req.headers!.Authorization === 'Bearer old') {
        revoked = false
        return { status: 401 }
      }
      return happy()(req)
    })
    t.nvs.patch({ device_token: 'old', device_id: 'dev1' })
    const r = await t.engine.cycle('boot')
    expect(r.outcome).toBe('painted')
    expect(t.nvs.get().device_token).toBe('tok12345')
    expect(t.http.find(/discover/)).toHaveLength(1)
  })

  it('shows a network error and retries', async () => {
    const t = setup(() => new HttpError('network', 'boom'))
    const r = await t.engine.cycle('boot')
    expect(r).toEqual({ sleepS: 60, outcome: 'unreachable' })
    expect(t.nvs.get().display).toMatchObject({ title: "Can't reach the server" })
  })

  it('surfaces mixed content distinctly', async () => {
    const t = setup(() => new HttpError('mixed-content', 'blocked'))
    await t.engine.cycle('boot')
    const d = t.nvs.get().display
    expect(d.kind === 'splash' && d.lines.join(' ')).toMatch(/mixed content/)
  })

  it('simulated Wi-Fi outage makes no requests', async () => {
    const t = setup(happy(), { settings: { wifi: 'outage' } })
    const r = await t.engine.cycle('boot')
    expect(r.outcome).toBe('wifi-outage')
    expect(t.http.calls).toHaveLength(0)
    expect(t.nvs.get().display).toMatchObject({ title: 'Wi-Fi unavailable' })
  })

  it('delivers a button press on the frame GET, once', async () => {
    const t = setup(happy())
    await t.engine.cycle('boot')
    t.http.calls.length = 0
    t.engine.pressButton('right')
    await t.engine.cycle('button')
    expect(t.http.calls[0].url).toContain('?button=right&button_event_id=1')
    expect(JSON.parse(t.http.find(/status/)[0].body!).button).toBeUndefined()
    t.http.calls.length = 0
    await t.engine.cycle('timer')
    expect(t.http.calls[0].url).not.toContain('button=')
  })

  it('falls back to /status when the frame GET fails to deliver the press', async () => {
    const t = setup(happy())
    await t.engine.cycle('boot')
    t.http.calls.length = 0
    const inner = t.http.handler
    t.http.handler = (req) => (req.url.includes('/frame') ? { status: 500 } : inner(req))
    t.engine.pressButton('refresh')
    await t.engine.cycle('button')
    expect(JSON.parse(t.http.find(/status/)[0].body!)).toMatchObject({
      button: 'refresh',
      button_event_id: 1,
    })
  })

  it('emits a beep when the server config enables it', async () => {
    const t = setup(happy(48000, { beep_enabled: true, beep_volume: 30, beep_pattern: '880:100' }))
    await t.engine.cycle('boot')
    expect(t.events).toContainEqual({ type: 'beep', pattern: '880:100', volume: 30 })
  })
})

describe('runner', () => {
  it('cycles, persists wake_at, and wakes on demand', async () => {
    const t = setup(happy())
    const sleeps: (number | null)[] = []
    const runner: Runner = new Runner(t.engine, t.clock, t.nvs, {
      onSleep: (w) => {
        sleeps.push(w)
        if (sleeps.length === 2) runner.stop()
        else queueMicrotask(() => runner.wake('manual'))
      },
    })
    runner.start()
    await new Promise((r) => setTimeout(r, 20))
    expect(sleeps).toHaveLength(2)
    expect(t.nvs.get().wake_at).toBe(sleeps[1])
    expect(t.http.find(/\/status/).length).toBe(2)
  })

  it('resumes a persisted sleep instead of cycling on reload', async () => {
    const t = setup(happy())
    t.nvs.patch({ wake_at: t.clock.now() + 60_000 })
    const runner = new Runner(t.engine, t.clock, t.nvs, { onSleep: () => runner.stop() })
    runner.start()
    await new Promise((r) => setTimeout(r, 10))
    expect(t.http.calls).toHaveLength(0)
  })
})
