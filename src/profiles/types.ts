import type { PanelFormat } from '@/panel/decoders'

export interface ButtonSpec {
  name: string
  label: string
  /** Tailwind colour classes for the cap. */
  cap: string
}

/** Everything that differs between boards: new boards are data (plus a decoder if needed). */
export interface DeviceProfile {
  id: string
  label: string
  /** `kind` sent to the server in discover/register. */
  kind: string
  panelW: number
  panelH: number
  /** BOARD_FRAMEBUFFER_ROTATION, degrees. */
  rotation: number
  format: PanelFormat
  buttons: ButtonSpec[]
  battery: { minMv: number; maxMv: number }
  idPrefix: string
  envSensor?: 'sht4x' | 'sht3x' | 'shtc3'
}
