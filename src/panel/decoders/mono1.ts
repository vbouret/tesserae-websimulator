import type { Decoder } from './types'

/** 1bpp, rows padded to whole bytes, MSB = leftmost pixel, bit 1 = white. */
export const mono1: Decoder = {
  frameBytes: (w, h) => Math.ceil(w / 8) * h,
  decode(bytes, w, h) {
    const stride = Math.ceil(w / 8)
    const out = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const bit = (bytes[y * stride + (x >> 3)] >> (7 - (x & 7))) & 1
        const v = bit ? 255 : 0
        const o = (y * w + x) * 4
        out[o] = out[o + 1] = out[o + 2] = v
        out[o + 3] = 255
      }
    }
    return out
  },
  encode(rgba, w, h) {
    const stride = Math.ceil(w / 8)
    const out = new Uint8Array(stride * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4
        const lum = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2]
        if (lum >= 128) out[y * stride + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
    return out
  },
}
