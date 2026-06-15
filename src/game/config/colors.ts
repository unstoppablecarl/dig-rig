import { Display } from 'phaser'
import { rgbToColor } from '../helpers/color-converters.ts'
import {
  ACID,
  BURNING_THERMITE,
  C4,
  CHILLED_ICE,
  CONCRETE,
  CRYO,
  EMPTY,
  FALLING_WAX,
  FIRE,
  FUSE,
  GUNPOWDER,
  ICE,
  LAVA,
  type MatterType,
  METHANE,
  NAPALM,
  NITRO,
  OIL,
  PERMANENT,
  PLANT,
  ROCK,
  SALT,
  SALT_WATER,
  SAND,
  SOLID,
  STEAM,
  THERMITE,
  WATER,
  WAX,
} from '../lib/Matter/_Matter.types.ts'
import { FireGroup, FireMode } from '../lib/Player/_FireMode-types'
import { BlendMode } from './blend-modes.ts'
import Interpolate = Display.Color.Interpolate
import Color = Phaser.Display.Color

export const BG_COLOR = rgbToColor(`rgb(79, 86, 99)`).color

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
export const BRUSH_OUTLINE_COLOR = rgbToColor(`rgba(255, 255, 0)`)

export type MatterRenderConfig = typeof MATTER_RENDER_CONFIG_DEFAULTS
export type PartialMatterRenderConfig = {
  [K in keyof MatterRenderConfig]?: Partial<MatterRenderConfig[K]>
}

export const MATTER_RENDER_CONFIG_DEFAULTS = {
  [PERMANENT]: solidMatterConfig({
    color: rgbToColor(`rgb(0, 255, 255)`),
    blendMode: BlendMode.OVERLAY,
    blendModeStrength: 0.8,
    outlineColor: rgbToColor(`rgb(255, 200, 200)`),
    outlineOpacity: 0.75,
  }),
  [SOLID]: solidMatterConfig({
    // no color used
    color: rgbToColor(`rgb(0, 0, 0)`),
    outlineColor: rgbToColor(`rgb(255, 200, 200)`),
    outlineOpacity: 0.45,
    outlineBlendModeStrength: 0.75,
    outlineBlendMode: BlendMode.OVERLAY,
  }),
  [SAND]: solidMatterConfig({
    color: rgbToColor(`rgb(195 168 117)`),
    settledColorHighlight: rgbToColor(`rgb(170 138 64)`),
    settledColor: rgbToColor(`rgb(119 90 29)`),
    settledOutlineColor: rgbToColor(`rgb(221 200 97)`),
    settledOutlineBlendMode: BlendMode.OVERLAY,
  }),
  [ROCK]: solidMatterConfig({
    color: rgbToColor(`rgb(103, 64, 27)`),
    settledColor: rgbToColor(`rgb(69, 41, 8)`),
    rockSettledColorHighlight: rgbToColor(`rgb(143 93 36)`),
    settledOutlineColor: rgbToColor(`rgb(138 123 73)`),
    settledTransitionColor: rgbToColor(`rgb(80, 60, 40)`),
  }),
  [SALT]: solidMatterConfig({
    color: rgbToColor(`rgb(252, 252, 252)`),
    settledColor: rgbToColor(`rgb(215, 215, 210)`),
    settledOutlineColor: rgbToColor(`rgb(255, 255, 255)`),
    settledTransitionColor: rgbToColor(`rgb(200, 190, 170)`),
  }),
  [ICE]: solidMatterConfig({
    color: rgbToColor(`rgb(161, 232, 255)`),
    alpha: 0.85,
    settledColor: rgbToColor(`rgb(125, 200, 235)`),
    settledOutlineColor: rgbToColor(`rgb(195, 248, 255)`),
  }),
  [CHILLED_ICE]: solidMatterConfig({
    color: rgbToColor(`rgb(20, 153, 219)`),
    alpha: 0.9,
    settledColor: rgbToColor(`rgb(13, 115, 175)`),
    settledOutlineColor: rgbToColor(`rgb(55, 185, 245)`),
  }),
  [CONCRETE]: solidMatterConfig({
    color: rgbToColor(`rgb(181, 181, 181)`),
    settledColor: rgbToColor(`rgb(145, 145, 145)`),
    settledOutlineColor: rgbToColor(`rgb(205, 205, 205)`),
  }),
  [WAX]: solidMatterConfig({
    color: rgbToColor(`rgb(240, 224, 212)`),
    settledColor: rgbToColor(`rgb(210, 190, 175)`),
    settledOutlineColor: rgbToColor(`rgb(255, 245, 235)`),
  }),
  [FUSE]: solidMatterConfig({
    color: rgbToColor(`rgb(219, 176, 199)`),
    settledColor: rgbToColor(`rgb(180, 140, 162)`),
    settledOutlineColor: rgbToColor(`rgb(245, 205, 225)`),
  }),
  [GUNPOWDER]: solidMatterConfig({
    color: rgbToColor(`rgb(171, 171, 140)`),
    settledColor: rgbToColor(`rgb(130, 130, 105)`),
    settledOutlineColor: rgbToColor(`rgb(200, 200, 165)`),
    settledTransitionColor: rgbToColor(`rgb(60, 55, 50)`),
  }),
  [NITRO]: solidMatterConfig({
    color: rgbToColor(`rgb(0, 150, 26)`),
    alpha: 0.90,
    settledTransitionColor: rgbToColor(`rgb(90, 160, 30)`),
  }),
  [C4]: solidMatterConfig({
    color: rgbToColor(`rgb(240, 230, 150)`),
    settledColor: rgbToColor(`rgb(205, 192, 115)`),
    settledOutlineColor: rgbToColor(`rgb(255, 252, 185)`),
  }),
  [THERMITE]: solidMatterConfig({
    color: rgbToColor(`rgb(194, 140, 69)`),
    settledColor: rgbToColor(`rgb(158, 108, 45)`),
    settledOutlineColor: rgbToColor(`rgb(222, 170, 100)`),
    settledTransitionColor: rgbToColor(`rgb(160, 70, 15)`),
  }),
  // liquid
  [WATER]: {
    alpha: 0.60,
    colorA: rgbToColor(`rgb(3 72 147)`),
    colorB: rgbToColor(`rgb(13, 166, 191)`),
  },
  [SALT_WATER]: solidMatterConfig({ color: rgbToColor(`rgb(128, 176, 255)`), alpha: 0.70 }),
  [OIL]: solidMatterConfig({ color: rgbToColor(`rgb(92, 46, 10)`), alpha: 0.95 }),
  [LAVA]: solidMatterConfig({
    color: rgbToColor(`rgb(245, 89, 15)`),
  }),
  [NAPALM]: solidMatterConfig({ color: rgbToColor(`rgb(219, 128, 69)`), alpha: 0.95 }),
  [ACID]: solidMatterConfig({ color: rgbToColor(`rgb(107, 240, 41)`), alpha: 0.8 }),
  // gas
  [STEAM]: solidMatterConfig({ color: rgbToColor(`rgb(194, 214, 235)`), alpha: 0.55 }),
  [METHANE]: solidMatterConfig({ color: rgbToColor(`rgb(140, 140, 140)`), alpha: 0.70 }),
  // other
  [FIRE]: solidMatterConfig({ color: rgbToColor(`rgb(255, 0, 0)`) }),
  [CRYO]: solidMatterConfig({ color: rgbToColor(`rgb(0, 214, 255)`), alpha: 0.8 }),
  [PLANT]: solidMatterConfig({
    color: rgbToColor(`rgb(13, 179, 26)`),
    settledColor: rgbToColor(`rgb(9, 130, 19)`),
    settledOutlineColor: rgbToColor(`rgb(35, 200, 50)`),
  }),
  [FALLING_WAX]: solidMatterConfig({ color: rgbToColor(`rgb(240, 224, 209)`), alpha: 0.85 }),
  [BURNING_THERMITE]: solidMatterConfig({
    color: rgbToColor(`rgb(255, 130, 130)`),
  }),
  [EMPTY]: {},
} as const satisfies Record<MatterType, any>

export function solidMatterConfig<T extends { color: Color, settledTransitionColor?: Color }>(value: T): T & {
  settledTransitionColor: Color
} {
  return {
    ...value,
    settledTransitionColor: value.settledTransitionColor ?? value.color,
  }
}

export function mergeMatterRenderConfig(a: MatterRenderConfig, b: PartialMatterRenderConfig): MatterRenderConfig {
  const out: Record<string, object> = {}
  for (const [key, item] of Object.entries(a)) {
    out[key] = { ...item, ...(b as Record<string, object>)[key] ?? {} }
  }
  return out as MatterRenderConfig
}

export const EDGE_GLOW_COLOR = rgbToColor(`rgb(50, 5, 5)`)

export const DEBUG_SETTLED_COLOR = rgbToColor(`rgb(255, 0, 150)`)
export const DEBUG_ANCHORED_COLOR = rgbToColor(`rgb(0, 200, 0)`)
