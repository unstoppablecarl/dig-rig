import { CHUNK_SIZE } from '../../config.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { PatternRenderer } from './_pattern-types.ts'
import NEAREST = Phaser.Textures.FilterMode.NEAREST

export function makePatternTerrainTexture(scene: GameLevel, patternRenderer: PatternRenderer) {
  const { width, height } = scene.tilemap
  if (scene.textures.exists('terrain_baked')) scene.textures.remove('terrain_baked')
  const texture = scene.textures.createCanvas('terrain_baked', width, height)!
  const buf = new ImageData(CHUNK_SIZE, CHUNK_SIZE)
  const pixels = new Uint32Array(buf.data.buffer)
  const chunkManager = scene.tilemap.chunkManager

  for (let cy = 0; cy < chunkManager.height; cy++) {
    for (let cx = 0; cx < chunkManager.width; cx++) {
      const offX = cx * CHUNK_SIZE
      const offY = cy * CHUNK_SIZE
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const tx = offX + x
          const ty = offY + y
          if (tx >= width || ty >= height) {
            pixels[y * CHUNK_SIZE + x] = 0
          } else {
            const color = patternRenderer(tx, ty, cx, cy)
            pixels[y * CHUNK_SIZE + x] =
              0xFF000000 |
              ((color & 0xFF) << 16) |
              (color & 0xFF00) |
              ((color >> 16) & 0xFF)
          }
        }
      }
      texture.context.putImageData(buf, offX, offY)
    }
  }

  texture.refresh()
  texture.source[0].setFilter(NEAREST)
  return texture
}
