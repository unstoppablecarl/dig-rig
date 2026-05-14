import { Display } from 'phaser'
import { TerrainType } from './lib/TileMap/TileMap.ts'

export const TILE_SIZE = 1 as const
export const CHUNK_SIZE = 64 as const

export const MOVEMENT_MULTIPLIER = TILE_SIZE
export const GRAVITY: number = 1
export const PLAYER_JUMP_POWER = -7 * MOVEMENT_MULTIPLIER
export const PLAYER_MOVE_SPEED = 3.5 * MOVEMENT_MULTIPLIER

export const DESTROY_COLOR = 0xff0046
export const CREATE_COLOR = 0x0046ff
export const PERMANENT_COLOR = 0x00ffff

export const CREATE_COLOR_RGB = Display.Color.ValueToColor(CREATE_COLOR)
export const DESTROY_COLOR_RGB = Display.Color.ValueToColor(DESTROY_COLOR)

export enum FireMode {
  CREATE,
  DESTROY,
}

export const BG_COLOR = 0x4F5663

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
export const DRAW_PARTICLE_DEBUG = false
export const DRAW_CHUNKS_DEBUG = false
export const DRAW_WORLD_BORDER_DEBUG = true
export const AUTO_START_LEVEL_INDEX = 0
