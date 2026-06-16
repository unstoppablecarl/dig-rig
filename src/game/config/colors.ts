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
import type { LiquidTypes, SettlingTypes } from '../lib/Matter/matter.ts'
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

type PowderConfig = {
  color: Color,
  settledTransitionColor?: Color
  settledColor?: Color
  settledColorHighlight?: Color
  settledOutlineColor?: Color
}

type LiquidConfig = {
  colorA: Color
  colorB: Color
  alpha: number
} | any

type MatterRenderConfigDefaults = {
  [K in MatterType]:
  K extends SettlingTypes
    ? K extends LiquidTypes
      ? LiquidConfig
      : K extends typeof MatterType.EMPTY
        ? {}
        : PowderConfig
    : any
}

export const MATTER_RENDER_CONFIG_DEFAULTS = {
  [PERMANENT]: {
    color: rgbToColor(`rgb(0, 255, 255)`),
    blendMode: BlendMode.OVERLAY,
    blendModeStrength: 0.8,
    outlineColor: rgbToColor(`rgb(255, 200, 200)`),
    outlineOpacity: 0.75,
  },
  [SOLID]: {
    outlineColor: rgbToColor(`rgb(255, 200, 200)`),
    outlineOpacity: 0.45,
    outlineBlendModeStrength: 0.75,
    outlineBlendMode: BlendMode.OVERLAY,
  },
  [SAND]: powderMatterConfig({
    color: rgbToColor(`rgb(195, 168, 117)`),
    settledColorHighlight: rgbToColor(`rgb(170, 138, 64)`),
    settledColor: rgbToColor(`rgb(119, 90, 29)`),
    settledOutlineColor: rgbToColor(`rgb(221, 200, 97)`),
    settledOutlineBlendMode: BlendMode.OVERLAY,
  }),
  [ROCK]: powderMatterConfig({
    color: rgbToColor(`rgb(103, 64, 27)`),
    settledColor: rgbToColor(`rgb(69, 41, 8)`),
    rockSettledColorHighlight: rgbToColor(`rgb(143, 93, 36)`),
    settledOutlineColor: rgbToColor(`rgb(138, 123, 73)`),
    settledTransitionColor: rgbToColor(`rgb(80, 60, 40)`),
  }),
  [SALT]: powderMatterConfig({
    color: rgbToColor(`rgb(252, 252, 252)`),
    settledColor: rgbToColor(`rgb(164, 200, 195)`),
    settledOutlineColor: rgbToColor(`rgb(255, 255, 255)`),
    rockSettledColorHighlight: rgbToColor(`rgb(255, 255, 255)`),
  }),
  [ICE]: powderMatterConfig({
    color: rgbToColor(`rgb(161, 232, 255)`),
    alpha: 0.85,
    settledColor: rgbToColor(`rgb(125, 200, 235)`),
    settledOutlineColor: rgbToColor(`rgb(195, 248, 255)`),
  }),
  [CHILLED_ICE]: powderMatterConfig({
    color: rgbToColor(`rgb(20, 153, 219)`),
    alpha: 0.9,
    settledColor: rgbToColor(`rgb(13, 115, 175)`),
    settledOutlineColor: rgbToColor(`rgb(55, 185, 245)`),
  }),
  [CONCRETE]: powderMatterConfig({
    color: rgbToColor(`rgb(181, 181, 181)`),
    settledColor: rgbToColor(`rgb(145, 145, 145)`),
    settledOutlineColor: rgbToColor(`rgb(205, 205, 205)`),
  }),
  [WAX]: powderMatterConfig({
    color: rgbToColor(`rgb(240, 224, 212)`),
    settledColor: rgbToColor(`rgb(210, 190, 175)`),
    settledOutlineColor: rgbToColor(`rgb(255, 245, 235)`),
  }),
  [FUSE]: powderMatterConfig({
    color: rgbToColor(`rgb(219, 176, 199)`),
    settledColor: rgbToColor(`rgb(180, 140, 162)`),
    settledOutlineColor: rgbToColor(`rgb(245, 205, 225)`),
  }),
  [GUNPOWDER]: powderMatterConfig({
    color: rgbToColor(`rgb(171, 171, 140)`),
    settledColor: rgbToColor(`rgb(130, 130, 105)`),
    settledOutlineColor: rgbToColor(`rgb(200, 200, 165)`),
    settledTransitionColor: rgbToColor(`rgb(60, 55, 50)`),
  }),
  [NITRO]: powderMatterConfig({
    color: rgbToColor(`rgb(0, 150, 26)`),
    settledTransitionColor: rgbToColor(`rgb(90, 160, 30)`),
    alpha: 0.90,
  }),
  [C4]: powderMatterConfig({
    color: rgbToColor(`rgb(240, 230, 150)`),
    settledColor: rgbToColor(`rgb(205, 192, 115)`),
    settledOutlineColor: rgbToColor(`rgb(255, 252, 185)`),
  }),
  [THERMITE]: powderMatterConfig({
    color: rgbToColor(`rgb(194, 140, 69)`),
    settledColor: rgbToColor(`rgb(158, 108, 45)`),
    settledOutlineColor: rgbToColor(`rgb(222, 170, 100)`),
    settledTransitionColor: rgbToColor(`rgb(160, 70, 15)`),
  }),
  // liquid
  [WATER]: {
    alpha: 0.60,
    colorA: rgbToColor(`rgb(3, 72, 147)`),
    colorB: rgbToColor(`rgb(13, 166, 191)`),
  },
  [SALT_WATER]: {
    colorA: rgbToColor(`rgb(13, 117, 191)`),
    colorB: rgbToColor(`rgb(128, 176, 255)`),
    alpha: 0.70,
  },
  [OIL]: {
    colorA: rgbToColor(`rgb(92, 46, 10)`),
    colorB: rgbToColor(`rgb(122, 71, 32)`),
    alpha: 0.95,
  },
  [LAVA]: {
    colorA: rgbToColor(`rgb(245, 89, 15)`),
    colorB: rgbToColor(`rgb(245, 199, 15)`),
    alpha: 1,
  },
  [NAPALM]: {
    colorA: rgbToColor(`rgb(219, 128, 69)`),
    colorB: rgbToColor(`rgb(219, 69, 69)`),
    alpha: 0.95,
  },
  [ACID]: {
    colorA: rgbToColor(`rgb(107, 240, 41)`),
    colorB: rgbToColor(`rgb(240, 223, 41)`),
    alpha: 0.8,
  },
  // gas
  [STEAM]: powderMatterConfig({ color: rgbToColor(`rgb(194, 214, 235)`), alpha: 0.55 }),
  [METHANE]: powderMatterConfig({ color: rgbToColor(`rgb(140, 140, 140)`), alpha: 0.70 }),
  // other
  [FIRE]: powderMatterConfig({ color: rgbToColor(`rgb(255, 0, 0)`) }),
  [CRYO]: powderMatterConfig({ color: rgbToColor(`rgb(0, 214, 255)`), alpha: 0.8 }),
  [PLANT]: powderMatterConfig({
    color: rgbToColor(`rgb(13, 179, 26)`),
    settledColor: rgbToColor(`rgb(9, 130, 19)`),
    settledOutlineColor: rgbToColor(`rgb(35, 200, 50)`),
  }),
  [FALLING_WAX]: powderMatterConfig({ color: rgbToColor(`rgb(240, 224, 209)`), alpha: 0.85 }),
  [BURNING_THERMITE]: powderMatterConfig({
    color: rgbToColor(`rgb(255, 130, 130)`),
  }),
  [EMPTY]: {},
} satisfies MatterRenderConfigDefaults

export function powderMatterConfig<T extends {
  color: Color,
  settledTransitionColor?: Color
}>(value: T): T & PowderConfig {
  return {
    ...value,
    settledTransitionColor: value.settledTransitionColor ?? value.color,
  }
}

export type PartialMatterRenderConfig = {
  [K in keyof MatterRenderConfig]?: Partial<MatterRenderConfig[K]>
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
