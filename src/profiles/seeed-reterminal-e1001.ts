import type { DeviceProfile } from './types'

export const e1001Buttons = [
  { name: 'left', label: '◀', cap: 'bg-zinc-200 text-zinc-700' },
  { name: 'right', label: '▶', cap: 'bg-zinc-200 text-zinc-700' },
  { name: 'refresh', label: '⟳', cap: 'bg-emerald-500 text-white' },
]

export const e1001: DeviceProfile = {
  id: 'e1001',
  label: 'Seeed reTerminal E1001 (mono)',
  kind: 'seeed_reterminal_e1001',
  panelW: 800,
  panelH: 480,
  rotation: 0,
  format: 'mono1',
  buttons: e1001Buttons,
  battery: { minMv: 3300, maxMv: 4200 },
  idPrefix: 'reTerminal_E1001',
  hasEnvSensor: true,
}
