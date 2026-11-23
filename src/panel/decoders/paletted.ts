import type { Decoder } from './types'

type Color = readonly [number, number, number]
const black: Color = [0, 0, 0]
const white: Color = [255, 255, 255]
const red: Color = [190, 30, 30]
const yellow: Color = [230, 200, 0]

function paletted(bits: 2 | 4, palette: readonly Color[]): Decoder {
  const perByte = 8 / bits
  const mask = (1 << bits) - 1
  return {
    frameBytes: (w, h) => Math.ceil(w / perByte) * h,
    decode(bytes, w, h) {
      const stride = Math.ceil(w / perByte)
      const out = new Uint8ClampedArray(w * h * 4)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const shift = 8 - bits * (1 + (x % perByte))
          const code = (bytes[y * stride + Math.floor(x / perByte)] >> shift) & mask
          const [r, g, b] = palette[code] ?? white
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
      const stride = Math.ceil(w / perByte)
      const out = new Uint8Array(stride * h)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4
          let best = 0
          let distance = Infinity
          palette.forEach(([r, g, b], code) => {
            const d = (rgba[o] - r) ** 2 + (rgba[o + 1] - g) ** 2 + (rgba[o + 2] - b) ** 2
            if (d < distance) {
              distance = d
              best = code
            }
          })
          out[y * stride + Math.floor(x / perByte)] |= best << (8 - bits * (1 + (x % perByte)))
        }
      }
      return out
    },
  }
}

export const bwr = paletted(2, [black, white, red])
export const bwry = paletted(2, [black, white, yellow, red])
export const acep7 = paletted(4, [
  black,
  white,
  [30, 130, 60],
  [20, 60, 170],
  red,
  yellow,
  [230, 120, 0],
])
