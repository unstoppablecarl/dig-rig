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