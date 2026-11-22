import type { DeviceProfile } from './types'
import { e1001 } from './seeed-reterminal-e1001'
import { e1001Gray } from './seeed-reterminal-e1001-gray'
import { decoders } from '@/panel/decoders'

export const profiles: DeviceProfile[] = [e1001, e1001Gray]
export const getProfile = (id: string): DeviceProfile => {
  const p = profiles.find((x) => x.id === id)
  if (!p) throw new Error(`Unknown device profile: ${id}`)
  return p
}
export const frameBytesFor = (p: DeviceProfile) => decoders[p.format].frameBytes(p.panelW, p.panelH)
export type { DeviceProfile }
