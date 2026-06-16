import { FireMode } from '../../Player/_FireMode-types'
import { PLAYER_HEIGHT, PLAYER_WIDTH } from '../../Player/Player.ts'
import type { Tilemap } from '../../Tilemap/Tilemap'
import type { ProjectileEffectResult } from './_ProjectileEffect.types.ts'

export function addTileFireModeEffect(tm: Tilemap, tiles: ProjectileEffectResult[], mode: FireMode): void {
  const startTime = tm.scene.time.now
  for (const { x, y } of tiles) tm.scene.tilemapRenderer.addFireModeEffect(x, y, mode, startTime)
}

export function chunkAndIslandCheck(tm: Tilemap, tiles: ProjectileEffectResult[]): void {
  tm.chunkManager.computeAnchored()
  const islands = tm.findIslandTiles(tiles)
  if (islands.length) tm.onIslandDetected?.(islands)
}

export function noVFX(): void {
}

const PLAYER_RADIUS_X = PLAYER_WIDTH * 0.5
const PLAYER_RADIUS_Y = PLAYER_HEIGHT * 0.5
const PLAYER_CREATE_VEL_EXTEND = 8

export function filterPlayerAABB(tm: Tilemap, x: number, y: number): boolean {
  const { x: px, y: py } = tm.scene.player
  const vel = tm.scene.player.container.body?.velocity
  const vx = vel?.x ?? 0, vy = vel?.y ?? 0
  const velLeft = Math.max(Math.min(vx, 0), -PLAYER_CREATE_VEL_EXTEND)
  const velRight = Math.min(Math.max(vx, 0), PLAYER_CREATE_VEL_EXTEND)
  const velUp = Math.max(Math.min(vy, 0), -PLAYER_CREATE_VEL_EXTEND)
  const velDown = Math.min(Math.max(vy, 0), PLAYER_CREATE_VEL_EXTEND)
  const left = px - PLAYER_RADIUS_X + velLeft
  const right = px + PLAYER_RADIUS_X + velRight
  const top = py - PLAYER_RADIUS_Y + velUp
  const bot = py + PLAYER_RADIUS_Y + velDown
  return !(x > left && x < right && y > top && y < bot)
}