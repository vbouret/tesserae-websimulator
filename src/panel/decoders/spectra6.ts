import type { Decoder } from './types'

/** Spectra 6 palette by nibble code. Codes 4 and 7..15 are unused and render as white. */
export const SPECTRA6_PALETTE: Record<number, readonly [number, number, number]> = {
  0: [0, 0, 0], // black
  1: [255, 255, 255], // white
  2: [230, 200, 0], // yellow
  3: [190, 30, 30], // red
  5: [20, 60, 170], // blue
  6: [30, 130, 60], // green
}
const WHITE = SPECTRA6_PALETTE[1]
const CODES = Object.keys(SPECTRA6_PALETTE).map(Number)

/** 4bpp palette indices, 2 px/byte, high nibble = left pixel, rows padded to whole bytes. */
export const spectra6: Decoder = {
  frameBytes: (w, h) => Math.ceil(w / 2) * h,
  decode(bytes, w, h) {
    const stride = Math.ceil(w / 2)
    const out = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const code = (bytes[y * stride + (x >> 1)] >> (x & 1 ? 0 : 4)) & 0xf
        const [r, g, b] = SPECTRA6_PALETTE[code] ?? WHITE
        const o = (y * w + x) * 4
        out[o] = r
        out[o + 1] = g
        out[o + 2] = b
        out[o + 3] = 255
      }
    }
    return out
  },
  encode(rgba, w, h) {
    const stride = Math.ceil(w / 2)
    const out = new Uint8Array(stride * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4
        let best = 1
        let bestD = Infinity
        for (const c of CODES) {
          const p = SPECTRA6_PALETTE[c]
          const d = (rgba[o] - p[0]) ** 2 + (rgba[o + 1] - p[1]) ** 2 + (rgba[o + 2] - p[2]) ** 2
          if (d < bestD) {
            bestD = d
            best = c
          }
        }
        out[y * stride + (x >> 1)] |= best << (x & 1 ? 0 : 4)
      }
    }
    return out
  },
}
