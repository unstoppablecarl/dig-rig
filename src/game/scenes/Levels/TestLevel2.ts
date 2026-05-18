import { Player } from '../../lib/Player/Player.ts'
import { TerrainType, Tilemap } from '../../lib/TileMap/TileMap.ts'
import type { TilemapRendererConfig } from '../../lib/TileMap/TilemapRenderer.ts'
import { GameLevel } from '../GameLevel.ts'
import CanvasTexture = Phaser.Textures.CanvasTexture

export default class TestLevel2 extends GameLevel {
  private TERRAIN: string

  preload() {
    super.preload()

    this.load.setPath('level-data')

    this.TERRAIN = this.loadPrefixedPixelImage('terrain', 'level-4.png')

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
    tilemap.setRect(0, ref - 100, tilemap.width, 500, TerrainType.SOLID)
    tilemap.setRect(200, ref - 160, 160, 60, TerrainType.SOLID)
    tilemap.setRect(230, ref - 200, 60, 60, TerrainType.SOLID)
    tilemap.setRect(450, ref - 220, 60, 60, TerrainType.SOLID)

    return tilemap
  }

  makePlayer() {
    return new Player(this, 100, 300)
  }
}
