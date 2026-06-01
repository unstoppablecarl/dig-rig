import { Player } from '../../lib/Player/Player.ts'
import { MatterType } from '../../lib/Tilemap/_Matter-types.ts'
import { Tilemap } from '../../lib/Tilemap/Tilemap.ts'
import type { TilemapRendererConfig } from '../../lib/Tilemap/TilemapRenderer.ts'
import { GameLevel } from '../GameLevel.ts'
import terrain from './TestLevel2/TestLevel2.png'
import CanvasTexture = Phaser.Textures.CanvasTexture

export default class TestLevel2 extends GameLevel {
  private TERRAIN: string

  preload() {
    super.preload()

    this.TERRAIN = this.loadPrefixedPixelImage('terrain', terrain)

    this.preloadPlayer()
  }

  protected tilemapRendererConfig(): Partial<TilemapRendererConfig> {
    return {
      glowStrength: 0.99,
      glowRadius: 12,
      outlineOpacity: 0.4,
    }
  }

  getTerrainTexture() {
    return this.textures.get(this.TERRAIN) as CanvasTexture
  }

  makeTileMap() {
    const tilemap = new Tilemap(
      this,
      2000,
      1000,
    )

    let ref = 600
    tilemap.setRect(0, ref - 100, tilemap.width, 500, MatterType.SOLID)
    tilemap.setRect(200, ref - 160, 160, 60, MatterType.SOLID)
    tilemap.setRect(230, ref - 200, 60, 60, MatterType.SOLID)
    tilemap.setRect(450, ref - 220, 60, 60, MatterType.SOLID)

    tilemap.setRect(200, ref - 100, 60, 60, MatterType.PERMANENT)

    return tilemap
  }

  makePlayer() {
    return new Player(this, 100, 300)
  }
}
