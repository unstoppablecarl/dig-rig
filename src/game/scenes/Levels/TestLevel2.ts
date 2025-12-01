import { Player } from '../../lib/Player/Player.ts'
import { TerrainType, Tilemap } from '../../lib/TileMap/TileMap.ts'
import { GameLevel } from '../GameLevel.ts'

export class TestLevel2 extends GameLevel {
  static ID = 'LEVEL_2'
  static DISPLAY_NAME = 'Test Level 2'

  constructor() {
    super(TestLevel2.ID)
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