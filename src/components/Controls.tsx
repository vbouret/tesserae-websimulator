import { useState } from 'react'
import { useSim } from '@/store/sim'
import { Button, Card, Field, Input, Select } from './ui/primitives'

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <Field label={`${label}: ${value}${unit}`}>
      <input
        type="range"
        className="w-full accent-accent"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  )
}

export function Controls({ id }: { id: string }) {
  const rt = useSim((s) => s.runtime[id])
  const { setSettings, setSpeed, setFastPaint, factoryReset } = useSim.getState()
  if (!rt) return null
  const s = rt.settings
  const check = (label: string, key: 'vbus' | 'charging') => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="accent-accent"
        checked={s[key]}
        onChange={(e) => setSettings(id, { [key]: e.target.checked })}
      />
      {label}
    </label>
  )
  return (
    <div className="space-y-4">
      <Card title="Simulation">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time speed" hint="Divides the server's sleep interval">
            <Select value={rt.speed} onChange={(e) => setSpeed(id, Number(e.target.value))}>
              {[1, 10, 60, 600].map((n) => (
                <option key={n} value={n}>
                  ×{n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Wi-Fi">
            <Select
              value={s.wifi}
              onChange={(e) => setSettings(id, { wifi: e.target.value as typeof s.wifi })}
            >
              <option value="ok">Connected</option>
              <option value="fail">Fails to connect</option>
              <option value="outage">Outage</option>
            </Select>
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-accent"
            checked={rt.fastPaint}
            onChange={(e) => setFastPaint(id, e.target.checked)}
          />
          Fast e-ink refresh
        </label>
      </Card>
      <Card title="Sensors & power">
        <div className="space-y-2">
          <Slider
            label="Battery"
            value={s.batteryPct}
            min={0}
            max={100}
            unit={`% (${s.batteryMv} mV)`}
            onChange={(v) => setSettings(id, { batteryPct: v })}
          />
          <Slider
            label="Drain per wake"
            value={s.drainPerCycle}
            min={0}
            max={5}
            step={0.1}
            unit="%"
            onChange={(v) => setSettings(id, { drainPerCycle: v })}
          />
          <Slider
            label="RSSI"
            value={s.rssi}
            min={-100}
            max={-30}
            unit=" dBm"
            onChange={(v) => setSettings(id, { rssi: v })}
          />
          <Slider
            label="Temperature"
            value={s.temperatureC}
            min={-20}
            max={50}
            step={0.1}
            unit=" °C"
            onChange={(v) => setSettings(id, { temperatureC: v })}
          />
          <Slider
            label="Humidity"
            value={s.humidityPct}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => setSettings(id, { humidityPct: v })}
          />
          <div className="flex gap-6">
            {check('USB power (vbus)', 'vbus')}
            {check('Charging', 'charging')}
          </div>
        </div>
      </Card>
      <Button
        variant="danger"
        onClick={() =>
          confirm('Wipe this device’s NVS (token, image, settings)?') && factoryReset(id)
        }
      >
        Factory reset
      </Button>
    </div>
  )
}

export function SetupForm({ id }: { id: string }) {
  const nvs = useSim((s) => s.runtime[id]?.nvs)
  const configure = useSim((s) => s.configure)
  const [draft, setDraft] = useState<{
    ssid: string
    url: string
    mode: 'discover' | 'pairing'
    code: string
  } | null>(null)
  if (!nvs) return null
  const v = draft ?? {
    ssid: nvs.ssid ?? '',
    url: nvs.server_url ?? '',
    mode: nvs.onboarding,
    code: nvs.pairing_code ?? '',
  }
  const set = (p: Partial<typeof v>) => setDraft({ ...v, ...p })
  return (
    <Card title="Setup (stands in for the captive portal)">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          configure(id, {
            ssid: v.ssid,
            server_url: v.url,
            onboarding: v.mode,
            pairing_code: v.code,
          })
          setDraft(null)
        }}
      >
        <Field label="Wi-Fi SSID (fake)">
          <Input
            value={v.ssid}
            onChange={(e) => set({ ssid: e.target.value })}
            placeholder="home"
          />
        </Field>
        <Field label="Tesserae server URL">
          <Input
            value={v.url}
            onChange={(e) => set({ url: e.target.value })}
            placeholder="http://localhost:8765"
          />
        </Field>
        <Field label="Onboarding">
          <Select
            value={v.mode}
            onChange={(e) => set({ mode: e.target.value as 'discover' | 'pairing' })}
          >
            <option value="discover">Discover (approve in Tesserae)</option>
            <option value="pairing">Pairing code</option>
          </Select>
        </Field>
        {v.mode === 'pairing' && (
          <Field label="Pairing code">
            <Input value={v.code} onChange={(e) => set({ code: e.target.value })} />
          </Field>
        )}
        <Button variant="primary" type="submit">
          Save & reboot device
        </Button>
      </form>
    </Card>
  )
}
