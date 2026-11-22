/** A panel wire format: packed bytes <-> RGBA. */
export interface Decoder {
  /** Exact byte length of a frame for the given geometry. */
  frameBytes(w: number, h: number): number
  decode(bytes: Uint8Array, w: number, h: number): Uint8ClampedArray
  /** Quantise RGBA down to the wire format (used for tests and status screens). */
  encode(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array
}
