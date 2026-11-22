import type { Decoder } from './types'

/** 4bpp grayscale, 2 px/byte, high nibble = left pixel, 0x0 black .. 0xF white, rows padded to whole bytes. */
export const gray4: Decoder = {
  frameBytes: (w, h) => Math.ceil(w / 2) * h,
  decode(bytes, w, h) {
    const stride = Math.ceil(w / 2)
    const out = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const code = (bytes[y * stride + (x >> 1)] >> (x & 1 ? 0 : 4)) & 0xf
        const v = code * 17
        const o = (y * w + x) * 4
        out[o] = out[o + 1] = out[o + 2] = v
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
        const lum = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2]
        const code = Math.min(15, Math.round(lum / 17))
        out[y * stride + (x >> 1)] |= code << (x & 1 ? 0 : 4)
      }
    }
    return out
  },
}
