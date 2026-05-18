import { Player } from '../../lib/Player/Player.ts'
import { TerrainType, Tilemap } from '../../lib/TileMap/TileMap.ts'
import { GameLevel } from '../GameLevel.ts'
import CanvasTexture = Phaser.Textures.CanvasTexture

export default class TestLevel2 extends GameLevel {
  preload() {
    super.preload()

    this.load.setPath('level-data')

    this.loadPixelImage('terrain', 'level-4.png')

    this.preloadPlayer()
  }

  getTerrainTexture() {
    return this.textures.get('terrain') as CanvasTexture
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
