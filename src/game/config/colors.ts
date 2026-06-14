import { Display } from 'phaser'
import { rgbToColor } from '../helpers/color-converters.ts'
import { MatterType } from '../lib/Matter/_Matter.types.ts'
import { FireGroup, FireMode } from '../lib/Player/_FireMode-types'
import Interpolate = Display.Color.Interpolate
import Color = Phaser.Display.Color

export const BG_COLOR = rgbToColor(`rgb(79, 86, 99)`).color
export const PERMANENT_COLOR_RGB = rgbToColor(`rgb(0, 255, 255)`)

// fire mode colors
export const DESTROY_COLOR = rgbToColor(`rgba(255, 0, 70)`)
export const CREATE_COLOR = rgbToColor(`rgba(0, 70, 255)`)
export const MELT_COLOR = rgbToColor(`rgba(255, 70, 0)`)
export const SOLIDIFY_COLOR = rgbToColor(`rgba(70, 255, 0)`)

export const FIRE_MODE_COLORS: Record<FireMode, Color> = {
  [FireMode.DESTROY]: DESTROY_COLOR,
  [FireMode.CREATE]: CREATE_COLOR,
  [FireMode.MELT]: MELT_COLOR,
  [FireMode.SOLIDIFY]: SOLIDIFY_COLOR,
}

export const FIRE_GROUP_COLORS: Record<FireGroup, number> = {
  [FireGroup.CREATE_DESTROY]: Interpolate.ColorWithColor(CREATE_COLOR, DESTROY_COLOR, 1, 0.5).color,
  [FireGroup.SOLIDIFY_MELT]: Interpolate.ColorWithColor(MELT_COLOR, SOLIDIFY_COLOR, 1, 0.5).color,
}

// 0xRRGGBB color constants matching the GLSL matterType colors
export const PARTICLE_FIRE_COLOR = 0xff0000
export const LAVA_COLOR = 0xF55A0F
export const ROCK_COLOR = 0x442808

export const BRUSH_OUTLINE_COLOR = rgbToColor(`rgba(255, 255, 0)`)
export const SETTLE_TRANSITION_COLORS: Partial<Record<MatterType, Color>> = {
  [MatterType.SAND]: rgbToColor(`rgba(139, 90, 43)`),
  [MatterType.ROCK]: rgbToColor(`rgba(80, 60, 40)`),
  [MatterType.SALT]: rgbToColor(`rgba(200, 190, 170)`),
  [MatterType.THERMITE]: rgbToColor(`rgba(160, 70, 15)`),
  [MatterType.GUNPOWDER]: rgbToColor(`rgba(60, 55, 50)`),
  [MatterType.NITRO]: rgbToColor(`rgba(90, 160, 30)`),
}