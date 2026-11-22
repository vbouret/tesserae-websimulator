import type { Decoder } from './types'

/** Levels for codes 00 (black) .. 11 (white). */
export const GRAY2_LEVELS = [0x00, 0x55, 0xaa, 0xff] as const

/** 2bpp, 4 px/byte, MSB-first, rows padded to whole bytes. */
export const gray2: Decoder = {
  frameBytes: (w, h) => Math.ceil(w / 4) * h,
  decode(bytes, w, h) {
    const stride = Math.ceil(w / 4)
    const out = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const code = (bytes[y * stride + (x >> 2)] >> (6 - 2 * (x & 3))) & 3
        const v = GRAY2_LEVELS[code]
        const o = (y * w + x) * 4
        out[o] = out[o + 1] = out[o + 2] = v
        out[o + 3] = 255
      }
    }
    return out
  },
  encode(rgba, w, h) {
    const stride = Math.ceil(w / 4)
    const out = new Uint8Array(stride * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4
        const lum = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2]
        const code = Math.min(3, Math.round(lum / 85))
        out[y * stride + (x >> 2)] |= code << (6 - 2 * (x & 3))
      }
    }
    return out
  },
}
