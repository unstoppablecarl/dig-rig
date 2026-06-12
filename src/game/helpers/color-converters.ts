import { Display } from 'phaser'
import type { RGBColor } from '../../types/_types.ts'
import type { RGBShaderColor } from '../types.ts'
import Color = Display.Color

// lighten/darken
export function shiftColorValue(color: number, amount: number): number {
  let r = (color >> 16) & 0xFF
  let g = (color >> 8) & 0xFF
  let b = color & 0xFF

  r = Math.max(0, r + amount)
  g = Math.max(0, g + amount)
  b = Math.max(0, b + amount)

  return (r << 16) | (g << 8) | b
}

export function rgbToVec3(colorString: string): RGBShaderColor {
  const regex = /[\d.]+/g
  const matches = colorString.match(regex)

  if (!matches) {
    throw new Error(`Invalid rgb color string "${colorString}"`)
  }

  const r = parseInt(matches[0], 10) / 255
  const g = parseInt(matches[1], 10) / 255
  const b = parseInt(matches[2], 10) / 255
  return [r, g, b]
}

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

export function rgbToRGB(colorString: string): RGBColor {
  const regex = /[\d.]+/g
  const matches = colorString.match(regex)

  if (!matches) {
    throw new Error(`Invalid rgb color string "${colorString}"`)
  }

  const r = parseInt(matches[0], 10)
  const g = parseInt(matches[1], 10)
  const b = parseInt(matches[2], 10)
  return { r, g, b }
}