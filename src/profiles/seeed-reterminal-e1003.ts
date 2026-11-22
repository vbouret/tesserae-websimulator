import type { DeviceProfile } from './types'
import { e1001, e1001Buttons } from './seeed-reterminal-e1001'

/** 10.3" 16-level gray panel, 1872×1404, 4bpp (1 314 144 B). */
export const e1003: DeviceProfile = {
  ...e1001,
  id: 'e1003',
  label: 'Seeed reTerminal E1003 (16-gray)',
  kind: 'seeed_reterminal_e1003',
  panelW: 1872,
  panelH: 1404,
  format: 'gray4',
  buttons: e1001Buttons,
  idPrefix: 'reTerminal_E1003',
}
