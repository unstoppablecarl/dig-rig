// must be power of 2
export const CHUNK_SIZE = 64 as const
export const GRAVITY: number = 1
export const PLAYER_JUMP_POWER = -7
export const PLAYER_MOVE_SPEED = 3.5
export const DEFAULT_PLAYER_STARTING_MATTER = 400
export const DEFAULT_PLAYER_MATTER_TANK_SIZE = 5000

// hard limits
export const MAX_PROJECTILES = 512
export const MAX_MATTER_TANKS = 256

// vfx limits
export const MAX_MATTER_PARTICLES = 0
export const VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE = 4

// shaders
export const GLOW_ENABLED = true
export const ICE_TEXTURE_ENABLED = true

// debug
export const ENABLE_PANE_DEBUG = true
export const ENABLE_BRUSH_MODE_DEBUG = true
export const ENABLE_SPAWN_OBJ_MODE_DEBUG = true
export const DRAW_TERRAIN_SETTLED_DEBUG = false
export const DRAW_PHYSICS_BODY_TILES_DEBUG = false
export const DRAW_ANCHORED_DEBUG = false
export const DRAW_PARTICLE_DEBUG = false
export const DRAW_WORLD_BORDER_DEBUG = false
export const ENABLE_MATTER_TANK_DEBUG = false
export const ENABLE_MATTER_CONSERVATION_CHECK = false
export const MATTER_CONSERVATION_CHECK_INTERVAL_FRAMES = 300
export const AUTO_START_LEVEL_INDEX = 0
