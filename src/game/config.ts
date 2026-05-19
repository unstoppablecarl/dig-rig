import { Display } from 'phaser'
import { TerrainType } from './lib/Tilemap/Tilemap.ts'
import GetColor = Display.Color.GetColor
import ValueToColor = Display.Color.ValueToColor

export const CHUNK_SIZE = 64 as const

export const GRAVITY: number = 1
export const PLAYER_JUMP_POWER = -7
export const PLAYER_MOVE_SPEED = 3.5

export const DESTROY_COLOR = GetColor(255, 0, 70)
export const CREATE_COLOR = GetColor(0, 70, 255)
export const PERMANENT_COLOR = GetColor(0, 255, 255)

export const CREATE_COLOR_RGB = ValueToColor(CREATE_COLOR)
export const DESTROY_COLOR_RGB = ValueToColor(DESTROY_COLOR)

export enum FireMode {
  CREATE,
  DESTROY,
}

export const BG_COLOR = GetColor(79, 86, 99)

export const PROJECTILE_MODE_COLORS = {
  [FireMode.CREATE]: CREATE_COLOR,
  [FireMode.DESTROY]: DESTROY_COLOR,
}
export const TERRAIN_TYPE_TRANSITION_COLORS = {
  [TerrainType.EMPTY]: DESTROY_COLOR,
  [TerrainType.SOLID]: CREATE_COLOR,
  [TerrainType.PERMANENT]: PERMANENT_COLOR,
}
export const MAX_MATTER_PARTICLES = 1500

export const PLAYER_MATTER_TANK_SIZE = 5000

export const GLOW_ENABLED = true
export const GLOW_TRANSITION_ANIMATION_ENABLED = false

export const DRAW_PARTICLE_DEBUG = false
export const DRAW_WORLD_BORDER_DEBUG = true
export const AUTO_START_LEVEL_INDEX = 0
