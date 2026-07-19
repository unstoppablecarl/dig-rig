import { PERMANENT, SAND, SOLID } from '../../lib/Matter/_Matter.types.ts'
import { Player } from '../../lib/Player/Player.ts'
import { ScaleLevelTexture } from '../../lib/Textures/ScaleLevelTexture.ts'
import { Tilemap } from '../../lib/Tilemap/Tilemap.ts'
import { TilemapBuilder } from '../../lib/Tilemap/TilemapBuilder.ts'
import { GameLevel } from '../GameLevel.ts'
import CanvasTexture = Phaser.Textures.CanvasTexture

// Fixed, deterministic heavy-load scenario for _scripts/bench-sim.mjs: a big
// block of unsettled sand dropped into an open basin, so a large active set
// exists from frame 0 without needing to script brush input. Mirrors
// BenchLevel.ts (oil flood) but with a granular matter type instead of a
// liquid, to A/B the sand/powder path of MatterSim separately from liquid flow.
const MAP_WIDTH = 1200
const MAP_HEIGHT = 900
const SAND_BLOCK_WIDTH = 700
const SAND_BLOCK_HEIGHT = 280
const FLOOR_HEIGHT = 150

export default class BenchLevelSand extends GameLevel {
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
      (MAP_WIDTH - SAND_BLOCK_WIDTH) / 2,
      50,
      SAND_BLOCK_WIDTH,
      SAND_BLOCK_HEIGHT,
      SAND,
    )
    builder.setBorder(2, PERMANENT)

    return builder.getTilemap()
  }

  makePlayer() {
    return new Player(this, 100, 300)
  }
}
