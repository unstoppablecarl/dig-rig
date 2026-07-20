import { ACID, PERMANENT } from '../../lib/Matter/_Matter.types.ts'
import { PLAYER_MATTER_TANK_ID } from '../../lib/Matter/Tank/_MatterTank.types.ts'
import { Player } from '../../lib/Player/Player.ts'
import { ScaleLevelTexture } from '../../lib/Textures/ScaleLevelTexture.ts'
import { Tilemap } from '../../lib/Tilemap/Tilemap.ts'
import { TilemapBuilder } from '../../lib/Tilemap/TilemapBuilder.ts'
import { GameLevel } from '../GameLevel.ts'
import CanvasTexture = Phaser.Textures.CanvasTexture

const MAP_WIDTH = 600
const MAP_HEIGHT = 400
const WATER_BLOCK_WIDTH = 20
const WATER_BLOCK_HEIGHT = 20
const FLOOR_HEIGHT = 150

export default class WaterLevelDrain extends GameLevel {
  registerEntities() {
    return []
  }

  private scaleLevelTexture: ScaleLevelTexture

  preload() {
    super.preload()
    this.scaleLevelTexture = new ScaleLevelTexture(this)
    this.scaleLevelTexture.preload()

    this.preloadPlayer()
  }

  getTerrainTexture(tilemap: Tilemap): CanvasTexture {
    return this.scaleLevelTexture.generate(tilemap)
  }

  makeTileMap() {
    const builder = TilemapBuilder.make(this, MAP_WIDTH, MAP_HEIGHT)

    builder.setRect(0, MAP_HEIGHT - FLOOR_HEIGHT, MAP_WIDTH, FLOOR_HEIGHT, PERMANENT)
    builder.setRect(
      (MAP_WIDTH - WATER_BLOCK_WIDTH) / 2,
      50,
      WATER_BLOCK_WIDTH,
      WATER_BLOCK_HEIGHT,
      ACID,
      PLAYER_MATTER_TANK_ID,
    )

    builder.setRectOrigin({
      x: MAP_WIDTH * 0.5,
      y: MAP_HEIGHT - FLOOR_HEIGHT,
      width: 100,
      height: 100,
      origin: {
        x: 0.5,
        y: 1,
      },
      value: PERMANENT,
    })

    builder.setRectOrigin({
      x: MAP_WIDTH * 0.5,
      y: MAP_HEIGHT - FLOOR_HEIGHT,
      width: 200,
      height: 60,
      origin: {
        x: 0.5,
        y: 1,
      },
      value: PERMANENT,
    })

    builder.setBorder(2, PERMANENT)

    return builder
  }

  makePlayer() {
    return new Player(this, 100, 200)
  }
}
