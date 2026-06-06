import { Display } from 'phaser'
import type { RGBColor } from '../../types/_types.ts'
import { FireGroup, FireMode } from '../lib/Player/_FireMode-types'
import GetColor = Display.Color.GetColor
import Interpolate = Display.Color.Interpolate
import ValueToColor = Display.Color.ValueToColor

export const BG_COLOR = GetColor(79, 86, 99)
export const PERMANENT_COLOR = GetColor(0, 255, 255)

// fire mode colors
export const DESTROY_COLOR = GetColor(255, 0, 70)
export const CREATE_COLOR = GetColor(0, 70, 255)
export const MELT_COLOR = GetColor(255, 70, 0)
export const SOLIDIFY_COLOR = GetColor(70, 255, 0)
export const PERMANENT_COLOR_RGB = ValueToColor(PERMANENT_COLOR)
export const DESTROY_COLOR_RGB = ValueToColor(DESTROY_COLOR)
export const CREATE_COLOR_RGB = ValueToColor(CREATE_COLOR)
export const MELT_COLOR_RGB = ValueToColor(MELT_COLOR)
export const SOLIDIFY_COLOR_RGB = ValueToColor(SOLIDIFY_COLOR)

export const FIRE_MODE_COLORS: Record<FireMode, number> = {
  [FireMode.DESTROY]: DESTROY_COLOR,
  [FireMode.CREATE]: CREATE_COLOR,
  [FireMode.MELT]: MELT_COLOR,
  [FireMode.SOLIDIFY]: SOLIDIFY_COLOR,
}

export const FIRE_GROUP_COLORS: Record<FireGroup, number> = {
  [FireGroup.CREATE_DESTROY]: Interpolate.ColorWithColor(CREATE_COLOR_RGB, DESTROY_COLOR_RGB, 1, 0.5).color,
  [FireGroup.SOLIDIFY_MELT]: Interpolate.ColorWithColor(MELT_COLOR_RGB, SOLIDIFY_COLOR_RGB, 1, 0.5).color,
}

export const FIRE_MODE_COLORS_RGB = Object.fromEntries(
  Object.entries(FIRE_MODE_COLORS).map(([key, value]) => {
    const { red: r, green: g, blue: b } = ValueToColor(value)
    return [key, { r, g, b }]
  }),
) as Record<FireMode, RGBColor>

// 0xRRGGBB color constants matching the GLSL element colors
export const FIRE_COLOR = 0xff0000
export const LAVA_COLOR = 0xF55A0F
export const ROCK_COLOR = 0x442808