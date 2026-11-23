import { describe, expect, it } from 'vitest'
import { mono1 } from './mono1'
import { gray2 } from './gray2'
import { gray4 } from './gray4'
import { spectra6 } from './spectra6'
import { acep7, bwr, bwry } from './paletted'

describe('mono1', () => {
  it('has the E1001 frame size', () => {
    expect(mono1.frameBytes(800, 480)).toBe(48000)
  })
  it('MSB is leftmost and 1 is white', () => {
    const bytes = new Uint8Array(1).fill(0b10000001)
    const px = mono1.decode(bytes, 8, 1)
    const v = Array.from({ length: 8 }, (_, i) => px[i * 4])
    expect(v).toEqual([255, 0, 0, 0, 0, 0, 0, 255])
    expect(px[3]).toBe(255)
  })
  it('decodes a checkerboard', () => {
    const bytes = new Uint8Array([0b10101010, 0b01010101])
    const px = mono1.decode(bytes, 8, 2)
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 8; x++) expect(px[(y * 8 + x) * 4]).toBe((x + y) % 2 === 0 ? 255 : 0)
  })
  it('round-trips through encode', () => {
    const bytes = Uint8Array.from({ length: 3 * 4 }, (_, i) => (i * 37) & 0xff)
    expect(mono1.encode(mono1.decode(bytes, 24, 4), 24, 4)).toEqual(bytes)
  })
})

describe('gray2', () => {
  it('has the E1001 gray frame size', () => {
    expect(gray2.frameBytes(800, 480)).toBe(96000)
  })
  it('packs 4 px/byte MSB-first, 00 black .. 11 white', () => {
    const px = gray2.decode(new Uint8Array([0b00011011]), 4, 1)
    expect([0, 1, 2, 3].map((i) => px[i * 4])).toEqual([0x00, 0x55, 0xaa, 0xff])
  })
  it('round-trips through encode', () => {
    const bytes = Uint8Array.from({ length: 8 * 3 }, (_, i) => (i * 91 + 5) & 0xff)
    expect(gray2.encode(gray2.decode(bytes, 32, 3), 32, 3)).toEqual(bytes)
  })
})

describe('gray4', () => {
  it('has the E1003 frame size', () => {
    expect(gray4.frameBytes(1872, 1404)).toBe(1314144)
  })
  it('high nibble is leftmost, 0 black .. F white', () => {
    const px = gray4.decode(new Uint8Array([0x0f]), 2, 1)
    expect([px[0], px[4]]).toEqual([0, 255])
  })
  it('round-trips through encode', () => {
    const bytes = Uint8Array.from({ length: 4 * 3 }, (_, i) => (i * 91 + 5) & 0xff)
    expect(gray4.encode(gray4.decode(bytes, 8, 3), 8, 3)).toEqual(bytes)
  })
})

describe('spectra6', () => {
  it('has the E1002 frame size', () => {
    expect(spectra6.frameBytes(800, 480)).toBe(192000)
  })

  describe('color palette formats', () => {
    it('decodes BWR indices with the reserved code as white', () => {
      const px = bwr.decode(new Uint8Array([0b00011011]), 4, 1)
      expect(Array.from(px)).toEqual([
        0, 0, 0, 255, 255, 255, 255, 255, 190, 30, 30, 255, 255, 255, 255, 255,
      ])
      expect(bwr.encode(px, 4, 1)).toEqual(new Uint8Array([0b00011001]))
    })

    it('decodes B/W/Y/R and respects row padding', () => {
      const bytes = new Uint8Array([0b00011000, 0b11100100])
      const px = bwry.decode(bytes, 3, 2)
      expect(Array.from(px.slice(8, 12))).toEqual([230, 200, 0, 255])
      expect(Array.from(px.slice(12, 16))).toEqual([190, 30, 30, 255])
      expect(bwry.encode(px, 3, 2)).toEqual(bytes)
      expect(bwry.frameBytes(1360, 480)).toBe(163200)
    })

    it('round-trips the seven-color ACeP palette', () => {
      const bytes = new Uint8Array([0x01, 0x23, 0x45, 0x60])
      expect(acep7.encode(acep7.decode(bytes, 8, 1), 8, 1)).toEqual(bytes)
    })
  })
  it('round-trips valid palette codes', () => {
    const codes = [0, 1, 2, 3, 5, 6, 1, 0]
    const bytes = Uint8Array.from({ length: 4 }, (_, i) => (codes[i * 2] << 4) | codes[i * 2 + 1])
    expect(spectra6.encode(spectra6.decode(bytes, 8, 1), 8, 1)).toEqual(bytes)
  })
})
