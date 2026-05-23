import { Display } from 'phaser'
import type { RGBColor } from '../../types/_types.ts'
import { FireMode } from '../config.ts'
import GetColor = Display.Color.GetColor
import ValueToColor = Display.Color.ValueToColor

export const BG_COLOR = GetColor(79, 86, 99)
export const PERMANENT_COLOR = GetColor(0, 255, 255)

// fire mode colors
export const DESTROY_COLOR = GetColor(255, 0, 70)
export const CREATE_COLOR = GetColor(0, 70, 255)
export const MELT_COLOR = GetColor(255, 70, 0)
export const SOLIDIFY_COLOR = GetColor(70, 255, 0)
export const CREATE_COLOR_RGB = ValueToColor(CREATE_COLOR)
export const DESTROY_COLOR_RGB = ValueToColor(DESTROY_COLOR)

export const FIRE_MODE_COLORS: Record<FireMode, number> = {
  [FireMode.DESTROY]: DESTROY_COLOR,
  [FireMode.CREATE]: CREATE_COLOR,
  [FireMode.MELT]: MELT_COLOR,
  [FireMode.SOLIDIFY]: SOLIDIFY_COLOR,
}

export const FIRE_MODE_COLORS_RGB = Object.fromEntries(
  Object.entries(FIRE_MODE_COLORS).map(([key, value]) => {
    const { red: r, green: g, blue: b } = ValueToColor(value)
    return [key, { r, g, b }]
  }),
) as Record<FireMode, RGBColor>