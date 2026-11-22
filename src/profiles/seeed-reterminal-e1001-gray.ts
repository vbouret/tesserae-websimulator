import type { DeviceProfile } from './types'
import { e1001, e1001Buttons } from './seeed-reterminal-e1001'

export const e1001Gray: DeviceProfile = {
  ...e1001,
  id: 'e1001-gray',
  label: 'Seeed reTerminal E1001 (4-gray)',
  kind: 'seeed_reterminal_e1001_gray',
  format: 'gray2',
  buttons: e1001Buttons,
}
