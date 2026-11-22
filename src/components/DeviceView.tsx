import { useState } from 'react'
import { getProfile } from '@/profiles'
import { useSim } from '@/store/sim'
import { fmtDuration, useNow } from '@/lib/useNow'
import { PanelCanvas } from './PanelCanvas'
import { Button } from './ui/primitives'

export function DeviceView({ id }: { id: string }) {
  const rt = useSim((s) => s.runtime[id])
  const rec = useSim((s) => s.runtime[id]?.nvs)
  const press = useSim((s) => s.press)
  const wake = useSim((s) => s.wake)
  const [zoom, setZoom] = useState<'fit' | '1:1'>('fit')
  const now = useNow()
  if (!rt || !rec) return null
  const profile = getProfile(rt.profileId)

  const awake = rt.state !== 'sleeping' && rt.state !== 'setup'
  const badge =
    rt.state === 'sleeping' && rt.wakeAt
      ? `Sleeping · wakes in ${fmtDuration(rt.wakeAt - now)}`
      : rt.state === 'setup'
        ? 'Waiting for setup'
        : `Awake · ${rt.state}`

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`h-[26px] inline-flex items-center px-[9px] text-xs font-semibold ${awake ? 'bg-warn-bg text-warn' : 'bg-sunk text-ink-soft'}`}
        >
          {badge}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setZoom(zoom === 'fit' ? '1:1' : 'fit')}>
            Zoom: {zoom}
          </Button>
          <Button variant="primary" disabled={awake} onClick={() => wake(id)}>
            Wake now
          </Button>
        </div>
      </div>

      <div className="overflow-auto">
        <div
          className="relative rounded-sm border border-edge bg-zinc-100 p-5 pb-4"
          style={{ width: zoom === 'fit' ? '100%' : profile.panelW + 40 }}
        >
          <div className="rounded border-8 border-zinc-300 bg-zinc-300">
            <PanelCanvas
              profile={profile}
              display={rt.display}
              seq={rt.displaySeq}
              animate={rt.animate}
              fast={rt.fastPaint}
              zoom={zoom}
            />
          </div>
          <div className="mt-3 flex items-center justify-center gap-4">
            <span
              title="Status LED"
              className={`size-3 rounded-full ${rt.led ? 'bg-emerald-400 shadow-[0_0_8px_2px_#34d399]' : 'bg-zinc-400'}`}
            />
            {profile.buttons.map((b) => (
              <button
                key={b.name}
                title={b.name}
                onClick={() => press(id, b.name)}
                className={`h-8 w-16 rounded-md text-sm border border-black/10 active:translate-y-px ${b.cap}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted">
        {rec.device_id ?? 'not registered'} · {rec.mac}
      </p>
    </div>
  )
}
