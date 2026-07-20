import { OIL, PERMANENT, SOLID } from '../../lib/Matter/_Matter.types.ts'
import { NO_MATTER_TANK_ID } from '../../lib/Matter/Tank/_MatterTank.types.ts'
import { Player } from '../../lib/Player/Player.ts'
import { ScaleLevelTexture } from '../../lib/Textures/ScaleLevelTexture.ts'
import { Tilemap } from '../../lib/Tilemap/Tilemap.ts'
import { TilemapBuilder } from '../../lib/Tilemap/TilemapBuilder.ts'
import { GameLevel } from '../GameLevel.ts'
import CanvasTexture = Phaser.Textures.CanvasTexture

// Fixed, deterministic heavy-load scenario for _scripts/bench-sim.mjs: a big
// block of unsettled oil dropped into an open basin, so a large active set
// exists from frame 0 without needing to script brush input (which can't be
// paced/timed deterministically the way baking the initial tile state can).
const MAP_WIDTH = 1200
const MAP_HEIGHT = 900
const OIL_BLOCK_WIDTH = 700
const OIL_BLOCK_HEIGHT = 280
const FLOOR_HEIGHT = 150

export default class BenchLevelFluid extends GameLevel {
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

    builder.setRect(0, MAP_HEIGHT - FLOOR_HEIGHT, MAP_WIDTH, FLOOR_HEIGHT, SOLID)
    builder.setRect(
      (MAP_WIDTH - OIL_BLOCK_WIDTH) / 2,
      50,
      OIL_BLOCK_WIDTH,
      OIL_BLOCK_HEIGHT,
      OIL,
      NO_MATTER_TANK_ID,
    )
    builder.setBorder(2, PERMANENT)

    return builder
  }

  makePlayer() {
    return new Player(this, 100, 300)
  }
}
