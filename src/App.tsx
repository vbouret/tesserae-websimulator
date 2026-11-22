import { useEffect, useRef, useState } from 'react'
import { profiles } from '@/profiles'
import { defaultServerUrl, useSim } from '@/store/sim'
import { DeviceView } from '@/components/DeviceView'
import { Controls, SetupForm } from '@/components/Controls'
import { Inspector } from '@/components/Inspector'
import { Button, Card, Field, Input, Select } from '@/components/ui/primitives'

function AddDevice({ onDone }: { onDone: () => void }) {
  const addDevice = useSim((s) => s.addDevice)
  const [f, setF] = useState({
    name: '',
    profileId: profiles[0].id,
    serverUrl: defaultServerUrl,
    ssid: 'home',
    onboarding: 'discover' as 'discover' | 'pairing',
    pairingCode: '',
  })
  return (
    <Card title="Add virtual device">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          await addDevice(f)
          onDone()
        }}
      >
        <Field label="Name">
          <Input
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="Living room"
          />
        </Field>
        <Field label="Board">
          <Select value={f.profileId} onChange={(e) => setF({ ...f, profileId: e.target.value })}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tesserae server URL">
          <Input
            value={f.serverUrl}
            onChange={(e) => setF({ ...f, serverUrl: e.target.value })}
            placeholder="http://localhost:8765"
          />
        </Field>
        <Field label="Wi-Fi SSID (fake)">
          <Input value={f.ssid} onChange={(e) => setF({ ...f, ssid: e.target.value })} />
        </Field>
        <Field label="Onboarding">
          <Select
            value={f.onboarding}
            onChange={(e) => setF({ ...f, onboarding: e.target.value as 'discover' | 'pairing' })}
          >
            <option value="discover">Discover (approve in Tesserae)</option>
            <option value="pairing">Pairing code</option>
          </Select>
        </Field>
        {f.onboarding === 'pairing' && (
          <Field label="Pairing code">
            <Input
              value={f.pairingCode}
              onChange={(e) => setF({ ...f, pairingCode: e.target.value })}
            />
          </Field>
        )}
        <div className="flex gap-2">
          <Button variant="primary" type="submit">
            Create
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}

export default function App() {
  const { ready, init, order, runtime, selectedId, select, removeDevice, exportJson, importJson } =
    useSim()
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => void init(), [init])

  if (!ready) return <p className="p-6 text-muted">Loading…</p>
  const showAdd = adding || order.length === 0

  const doExport = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }))
    a.download = 'tesserae-simulator-devices.json'
    a.click()
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-62 shrink-0 flex-col gap-1 border-r border-line bg-surface px-3 pt-5 pb-4">
        <h1 className="px-2 pb-5 text-[17px] leading-tight font-bold tracking-tight">
          Tesserae Device Simulator
        </h1>
        <div className="flex-1 space-y-0.5 overflow-auto">
          {order.map((id) => (
            <button
              key={id}
              onClick={() => {
                select(id)
                setAdding(false)
              }}
              className={`h-auto w-full px-3 py-2 text-left text-sm transition-colors duration-200 ${id === selectedId && !showAdd ? 'bg-selected font-semibold' : 'hover:bg-hover'}`}
            >
              <div className="truncate">{runtime[id]?.name}</div>
              <div className="font-mono text-[11px] text-muted">{runtime[id]?.state}</div>
            </button>
          ))}
        </div>
        <Button onClick={() => setAdding(true)}>+ Add device</Button>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={doExport} disabled={!order.length}>
            Export
          </Button>
          <Button variant="ghost" className="flex-1" onClick={() => fileRef.current?.click()}>
            Import
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            try {
              setMsg(`Imported ${await importJson(await file.text())} device(s)`)
            } catch (err) {
              setMsg((err as Error).message)
            }
          }}
        />
        {msg && <p className="text-xs text-ink-soft">{msg}</p>}
      </aside>

      <main className="flex-1 overflow-auto p-10">
        {showAdd ? (
          <div className="mx-auto max-w-md">
            <AddDevice onDone={() => setAdding(false)} />
          </div>
        ) : selectedId && runtime[selectedId] ? (
          <div
            className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]"
            key={selectedId}
          >
            <div className="space-y-5">
              <DeviceView id={selectedId} />
              <Inspector id={selectedId} />
            </div>
            <div className="space-y-4">
              <SetupForm id={selectedId} />
              <Controls id={selectedId} />
              <Button
                variant="ghost"
                onClick={() => confirm('Remove this device?') && removeDevice(selectedId)}
              >
                Remove device
              </Button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
