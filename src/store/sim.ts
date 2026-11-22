import { create } from 'zustand'
import { FetchHttp, LoggingHttp, type HttpLogEntry } from '@/engine/http'
import { RealClock } from '@/engine/clock'
import {
  FirmwareEngine,
  defaultSettings,
  type EngineState,
  type SimSettings,
  type WakeReason,
} from '@/engine/machine'
import { Nvs, fakeMac, newNvs, type DisplayState, type NvsData } from '@/engine/nvs'
import { Runner } from '@/engine/runner'
import { getProfile } from '@/profiles'
import { playBeep } from '@/lib/audio'
import { db, type DeviceRecord } from './db'

export interface TimelineEntry {
  at: number
  kind: 'state' | 'log' | 'sleep'
  level?: 'info' | 'warn' | 'error'
  text: string
}

export interface Runtime {
  name: string
  profileId: string
  state: EngineState
  wakeAt: number | null
  led: boolean
  display: DisplayState
  /** Bumped on every repaint; `animate` says whether to play the e-ink flash. */
  displaySeq: number
  animate: boolean
  nvs: NvsData
  settings: SimSettings
  speed: number
  fastPaint: boolean
  http: HttpLogEntry[]
  timeline: TimelineEntry[]
}

interface Instance {
  nvs: Nvs
  engine: FirmwareEngine
  runner: Runner
  settings: SimSettings
  record: DeviceRecord
}

export interface NewDevice {
  name: string
  profileId: string
  serverUrl: string
  ssid: string
  onboarding: 'discover' | 'pairing'
  pairingCode: string
}

const DEFAULT_SERVER = (import.meta.env.VITE_DEFAULT_SERVER_URL as string | undefined) ?? ''
export const defaultServerUrl = DEFAULT_SERVER

const instances = new Map<string, Instance>()
const MAX_LOG = 200

interface SimStore {
  ready: boolean
  order: string[]
  selectedId: string | null
  runtime: Record<string, Runtime>
  init(): Promise<void>
  select(id: string): void
  addDevice(d: NewDevice): Promise<string>
  removeDevice(id: string): Promise<void>
  configure(
    id: string,
    p: Partial<Pick<NvsData, 'ssid' | 'server_url' | 'onboarding' | 'pairing_code'>>,
  ): void
  setSettings(id: string, p: Partial<SimSettings>): void
  setSpeed(id: string, speed: number): void
  setFastPaint(id: string, v: boolean): void
  wake(id: string, reason?: WakeReason): void
  press(id: string, button: string): void
  factoryReset(id: string): void
  exportJson(): string
  importJson(text: string): Promise<number>
}

export const useSim = create<SimStore>((set, get) => {
  const patchRt = (id: string, fn: (r: Runtime) => Partial<Runtime>) =>
    set((s) =>
      s.runtime[id]
        ? { runtime: { ...s.runtime, [id]: { ...s.runtime[id], ...fn(s.runtime[id]) } } }
        : s,
    )

  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const persist = (id: string) => {
    clearTimeout(saveTimers.get(id))
    saveTimers.set(
      id,
      setTimeout(() => {
        const inst = instances.get(id)
        if (!inst) return
        const rt = get().runtime[id]
        void db.devices.put({
          ...inst.record,
          nvs: inst.nvs.get(),
          settings: inst.settings,
          speed: rt?.speed ?? 1,
          fastPaint: rt?.fastPaint ?? false,
        })
      }, 250),
    )
  }

  const pushTimeline = (id: string, e: Omit<TimelineEntry, 'at'>) =>
    patchRt(id, (r) => ({ timeline: [...r.timeline, { ...e, at: Date.now() }].slice(-MAX_LOG) }))

  function spawn(rec: DeviceRecord) {
    const profile = getProfile(rec.profileId)
    const clock = new RealClock()
    const nvs = new Nvs(rec.nvs)
    const settings: SimSettings = { ...defaultSettings(), ...rec.settings }
    const http = new LoggingHttp(
      new FetchHttp(),
      () => Date.now(),
      (e) => patchRt(rec.id, (r) => ({ http: [...r.http, e].slice(-MAX_LOG) })),
    )
    const engine = new FirmwareEngine({
      profile,
      clock,
      http,
      nvs,
      settings: () => settings,
      emit: (e) => {
        switch (e.type) {
          case 'state':
            patchRt(rec.id, () => ({ state: e.state }))
            pushTimeline(rec.id, {
              kind: 'state',
              text: e.note ? `${e.state} (${e.note})` : e.state,
            })
            break
          case 'display':
            patchRt(rec.id, (r) => ({
              display: e.display,
              displaySeq: r.displaySeq + 1,
              animate: e.refresh,
            }))
            break
          case 'led':
            patchRt(rec.id, () => ({ led: e.on }))
            break
          case 'beep':
            playBeep(e.pattern, e.volume)
            break
          case 'log':
            pushTimeline(rec.id, { kind: 'log', level: e.level, text: e.message })
        }
      },
      timing: {
        wifiConnectMs: 800,
        get paintMs() {
          return get().runtime[rec.id]?.fastPaint ? 400 : 3500
        },
      },
    })
    const runner = new Runner(engine, clock, nvs, {
      onSleep: (wakeAt, result) => {
        patchRt(rec.id, () => ({ state: wakeAt == null ? 'setup' : 'sleeping', wakeAt }))
        pushTimeline(rec.id, {
          kind: 'sleep',
          text:
            wakeAt == null
              ? `waiting for setup (${result.outcome})`
              : `sleep ${Math.round(result.sleepS ?? 0)}s (${result.outcome})`,
        })
      },
      onCycleEnd: () => {
        if (settings.drainPerCycle > 0) {
          settings.batteryPct = Math.max(
            0,
            +(settings.batteryPct - settings.drainPerCycle).toFixed(2),
          )
          settings.batteryMv = pctToMv(settings.batteryPct, profile.battery)
          patchRt(rec.id, () => ({ settings: { ...settings } }))
        }
      },
    })
    runner.speed = rec.speed
    nvs.subscribe((d) => {
      patchRt(rec.id, () => ({ nvs: d }))
      persist(rec.id)
    })
    instances.set(rec.id, { nvs, engine, runner, settings, record: rec })
    const rt: Runtime = {
      name: rec.name,
      profileId: rec.profileId,
      state: 'sleeping',
      wakeAt: nvs.get().wake_at ?? null,
      led: false,
      display: nvs.get().display,
      displaySeq: 0,
      animate: false,
      nvs: nvs.get(),
      settings: { ...settings },
      speed: rec.speed,
      fastPaint: rec.fastPaint,
      http: [],
      timeline: [],
    }
    set((s) => ({
      runtime: { ...s.runtime, [rec.id]: rt },
      order: s.order.includes(rec.id) ? s.order : [...s.order, rec.id],
    }))
    runner.start()
  }

  return {
    ready: false,
    order: [],
    selectedId: null,
    runtime: {},

    async init() {
      if (get().ready) return
      const recs = await db.devices.toArray()
      set({ ready: true })
      recs.forEach(spawn)
      if (recs.length) set({ selectedId: recs[0].id })
    },

    select: (id) => set({ selectedId: id }),

    async addDevice(d) {
      const id = crypto.randomUUID()
      const profile = getProfile(d.profileId)
      const nvs: NvsData = {
        ...newNvs(fakeMac(id)),
        ssid: d.ssid || undefined,
        server_url: d.serverUrl.trim() || undefined,
        onboarding: d.onboarding,
        pairing_code: d.pairingCode || undefined,
      }
      const settings = defaultSettings()
      settings.batteryMv = pctToMv(settings.batteryPct, profile.battery)
      const rec: DeviceRecord = {
        id,
        name: d.name || profile.label,
        profileId: d.profileId,
        nvs,
        settings,
        speed: 1,
        fastPaint: false,
      }
      await db.devices.put(rec)
      spawn(rec)
      set({ selectedId: id })
      return id
    },

    async removeDevice(id) {
      instances.get(id)?.runner.stop()
      instances.delete(id)
      await db.devices.delete(id)
      set((s) => {
        const { [id]: _gone, ...rest } = s.runtime
        void _gone
        const order = s.order.filter((x) => x !== id)
        return {
          runtime: rest,
          order,
          selectedId: s.selectedId === id ? (order[0] ?? null) : s.selectedId,
        }
      })
    },

    configure(id, p) {
      const inst = instances.get(id)
      if (!inst) return
      const clean = { ...p }
      if (clean.server_url !== undefined) clean.server_url = clean.server_url.trim() || undefined
      // New credentials: forget the old identity so the device re-onboards.
      const changedServer =
        clean.server_url !== undefined && clean.server_url !== inst.nvs.get().server_url
      inst.nvs.patch({
        ...clean,
        ...(changedServer ? { device_token: undefined, last_frame_etag: undefined } : {}),
        wake_at: undefined,
      })
      inst.runner.wake('config')
    },

    setSettings(id, p) {
      const inst = instances.get(id)
      if (!inst) return
      const profile = getProfile(inst.record.profileId)
      const next = { ...p }
      if (p.batteryPct !== undefined) next.batteryMv = pctToMv(p.batteryPct, profile.battery)
      Object.assign(inst.settings, next)
      patchRt(id, () => ({ settings: { ...inst.settings } }))
      persist(id)
    },

    setSpeed(id, speed) {
      const inst = instances.get(id)
      if (!inst) return
      inst.runner.speed = speed
      patchRt(id, () => ({ speed }))
      persist(id)
    },

    setFastPaint(id, v) {
      patchRt(id, () => ({ fastPaint: v }))
      persist(id)
    },

    wake(id, reason = 'manual') {
      instances.get(id)?.runner.wake(reason)
    },

    press(id, button) {
      const inst = instances.get(id)
      if (!inst) return
      inst.engine.pressButton(button)
      inst.runner.wake('button')
    },

    factoryReset(id) {
      const inst = instances.get(id)
      if (!inst) return
      inst.nvs.reset()
      patchRt(id, () => ({
        http: [],
        timeline: [],
        display: { kind: 'blank' },
        displaySeq: 0,
        animate: false,
      }))
      inst.runner.wake('boot')
    },

    exportJson() {
      const out = get().order.map((id) => {
        const inst = instances.get(id)!
        const {
          display: _d,
          device_token: _t,
          last_frame_etag: _e,
          wake_at: _w,
          ...nv
        } = inst.nvs.get()
        void [_d, _t, _e, _w]
        return {
          name: inst.record.name,
          profileId: inst.record.profileId,
          nvs: nv,
          settings: inst.settings,
        }
      })
      return JSON.stringify({ version: 1, devices: out }, null, 2)
    },

    async importJson(text) {
      const data = JSON.parse(text) as { version?: number; devices?: Partial<DeviceRecord>[] }
      if (!Array.isArray(data.devices)) throw new Error('Not a Tesserae simulator export')
      let n = 0
      for (const d of data.devices) {
        if (!d.profileId || !d.nvs) continue
        getProfile(d.profileId) // throws for unknown profiles
        const id = crypto.randomUUID()
        const nvs: NvsData = {
          ...newNvs(d.nvs.mac ?? fakeMac(id)),
          ...d.nvs,
          display: { kind: 'blank' },
        }
        const rec: DeviceRecord = {
          id,
          name: d.name ?? 'Imported device',
          profileId: d.profileId,
          nvs,
          settings: { ...defaultSettings(), ...d.settings },
          speed: 1,
          fastPaint: false,
        }
        await db.devices.put(rec)
        spawn(rec)
        n++
      }
      return n
    },
  }
})

export function pctToMv(pct: number, b: { minMv: number; maxMv: number }) {
  return Math.round(b.minMv + ((b.maxMv - b.minMv) * Math.max(0, Math.min(100, pct))) / 100)
}
