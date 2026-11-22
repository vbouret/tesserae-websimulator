import type { DeviceProfile } from './types'
import { e1001, e1001Buttons } from './seeed-reterminal-e1001'

/** 7.3" Spectra 6 colour panel, 800×480, 4bpp palette indices (192 000 B). */
export const e1002: DeviceProfile = {
  ...e1001,
  id: 'e1002',
  label: 'Seeed reTerminal E1002 (Spectra 6)',
  kind: 'seeed_reterminal_e1002',
  format: 'spectra6',
  buttons: e1001Buttons,
  idPrefix: 'reTerminal_E1002',
}
