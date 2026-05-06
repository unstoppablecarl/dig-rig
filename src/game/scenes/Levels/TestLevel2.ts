import { Player } from '../../lib/Player/Player.ts'
import { makeImagePatternRenderer } from '../../lib/Textures/PatternRenderer.ts'
import { TerrainType, Tilemap } from '../../lib/TileMap/TileMap.ts'
import { GameLevel } from '../GameLevel.ts'

export default class TestLevel2 extends GameLevel {
  preload() {
    super.preload()

    this.load.setPath('assets')

    this.loadPixelImage('scale', 'tiles/scale.png')
    this.loadPixelImage('scale-2', 'tiles/scale2.png')

    this.loadPixelImage('enemy', 'enemy-2.png')

    this.loadPixelImage('rock-tile', 'tiles/rock.png')

    this.preloadPlayer()
  }

  makeTileMapChunkPixelRenderer() {
    return makeImagePatternRenderer(this.textures, 'rock-tile')
  }

  makeTileMap() {
    const tilemap = new Tilemap(
      this,
      2000,
      600,
    )

    tilemap.setRect(0, 500, tilemap.width, 50, TerrainType.SOLID)
    tilemap.setRect(200, 440, 100, 60, TerrainType.SOLID)
    tilemap.setRect(230, 400, 60, 60, TerrainType.SOLID)

    tilemap.setRect(300 + 200, 440, 100, 60, TerrainType.SOLID)
    tilemap.setRect(300 + 230, 400, 60, 60, TerrainType.SOLID)

    return tilemap
  }

  makePlayer() {
    return new Player(this, 100, 300)
  }

  startLevel() {

  }
}