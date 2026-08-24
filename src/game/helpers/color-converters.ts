import { Display } from 'phaser'
import Color = Display.Color

export function rgbToColor(colorString: string): Color {
  const regex = /[\d.]+/g
  const matches = colorString.match(regex)

  if (!matches) {
    throw new Error(`Invalid rgb color string "${colorString}"`)
  }

  const r = parseInt(matches[0], 10)
  const g = parseInt(matches[1], 10)
  const b = parseInt(matches[2], 10)
  return new Color(r, g, b, 255)
}

export function rgbaToColor(colorString: string): Color {
  const regex = /[\d.]+/g
  const matches = colorString.match(regex)

  if (matches?.length !== 4) {
    throw new Error(`Invalid rgba color string "${colorString}"`)
  }

  const r = parseInt(matches[0], 10)
  const g = parseInt(matches[1], 10)
  const b = parseInt(matches[2], 10)
  const a = parseInt(matches[3], 10)

  return new Color(r, g, b, a)
}

// Packs r/g/b/a into a 32-bit int in platform-native (little-endian) byte order, so writing
// it into a Uint32Array view and reading the underlying bytes back gives [r, g, b, a] — the
// order gl.texSubImage2D expects for format RGBA / type UNSIGNED_BYTE.
// Do NOT use Color#color32 for this: it's big-endian ARGB (0xAARRGGBB), which stores as
// [b, g, r, a] on a little-endian Uint32Array view and swaps red/blue on upload.
export function packPixelRGBA(r: number, g: number, b: number, a: number): number {
  return (a << 24) | (b << 16) | (g << 8) | r
}

export function colorToPixelRGBA({ red, green, blue, alpha }: Color): number {
  return packPixelRGBA(red, green, blue, alpha)
}