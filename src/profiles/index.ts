import type { DeviceProfile } from './types'
import { boards } from './catalog'
import { decoders } from '@/panel/decoders'

export const profiles: DeviceProfile[] = boards
export const getProfile = (id: string): DeviceProfile => {
  const p = profiles.find((x) => x.id === id)
  if (!p) throw new Error(`Unknown device profile: ${id}`)
  return p
}
export const frameBytesFor = (p: DeviceProfile) => decoders[p.format].frameBytes(p.panelW, p.panelH)
export type { DeviceProfile }
