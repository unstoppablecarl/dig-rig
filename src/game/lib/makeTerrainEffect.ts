import { TerrainType } from './TileMap/TileMap.ts'
import { TERRAIN_TYPE_TRANSITION_COLORS, TILE_SIZE } from '../config.ts'
import type { GameLevel } from '../scenes/GameLevel.ts'

const DURATION = 1500

export function makeTerrainEffect(scene: GameLevel) {
  const graphics = scene.add.graphics()
  scene.layers.terrainEffect.add(graphics)

  return {
    addTile(x: number, y: number, value: TerrainType) {
      const effectColor = TERRAIN_TYPE_TRANSITION_COLORS[value] as number

      graphics.fillStyle(effectColor, 1)
      graphics.fillRect(
        x * TILE_SIZE,
        y * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE,
      )
    },
    start() {
      scene.tweens.add({
        targets: graphics,
        alpha: 0,
        duration: DURATION,
        onComplete() {
          graphics.destroy(true)
        },
      })
    },
  }
}