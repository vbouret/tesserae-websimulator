import type { Decoder } from './types'
import { mono1 } from './mono1'
import { gray2 } from './gray2'
import { gray4 } from './gray4'
import { spectra6 } from './spectra6'
import { bwr, bwry, acep7 } from './paletted'

export type PanelFormat = 'mono1' | 'gray2' | 'gray4' | 'spectra6' | 'bwr' | 'bwry' | 'acep7'
export const decoders: Record<PanelFormat, Decoder> = {
  mono1,
  gray2,
  gray4,
  spectra6,
  bwr,
  bwry,
  acep7,
}
export type { Decoder }
