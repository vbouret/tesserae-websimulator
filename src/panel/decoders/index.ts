import type { Decoder } from './types'
import { mono1 } from './mono1'
import { gray2 } from './gray2'

export type PanelFormat = 'mono1' | 'gray2'
export const decoders: Record<PanelFormat, Decoder> = { mono1, gray2 }
export type { Decoder }
