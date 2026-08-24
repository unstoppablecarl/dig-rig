import { PERMANENT, SAND, SOLID } from '../../lib/Matter/_Matter.types.ts'
import { Player } from '../../lib/Player/Player.ts'
import { ScaleLevelTexture } from '../../lib/Textures/ScaleLevelTexture.ts'
import { Tilemap } from '../../lib/Tilemap/Tilemap.ts'
import { TilemapBuilder } from '../../lib/Tilemap/TilemapBuilder.ts'
import { GameLevel } from '../GameLevel.ts'
import CanvasTexture = Phaser.Textures.CanvasTexture

// Fixed, deterministic "narrow but tall" heavy-load scenario for
// _scripts/bench-sim.mjs — the counterpart to BenchLevel(Fluid|Sand)'s wide,
// shallow block. A single narrow column of unsettled sand, deliberately
// confined to ONE real CHUNK_SIZE-wide chunk-column (SHAFT_X/SHAFT_WIDTH are
// chosen so the whole shaft sits inside cx=1, never spanning a chunk-column
// boundary) but spanning nearly the full map height (~46 chunk-rows). This
// is the worst case for a column-based worker dispatch scheme: the current
// 4-group checkerboard spreads this shaft's fall across many small per-real-
// chunk dispatch units (bounded in both x AND y), while a column-based
// scheme would collapse the whole thing into a single dispatch unit owned by
// one worker, no matter how tall it is. Used to A/B ENABLE_COLUMN_DISPATCH
// against the existing wide BENCH/BENCH_SAND scenarios, which don't surface
// this failure mode (see memory `project-sim-dispatch-jam`).
const MAP_WIDTH = 256
const MAP_HEIGHT = 3200
const SHAFT_X = 64
const SHAFT_WIDTH = 40
const SHAFT_TOP = 50
const FLOOR_HEIGHT = 150

export default class BenchLevelShaft extends GameLevel {
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
      SHAFT_X,
      SHAFT_TOP,
      SHAFT_WIDTH,
      MAP_HEIGHT - FLOOR_HEIGHT - SHAFT_TOP,
      SAND,
    )
    builder.setBorder(2, PERMANENT)

    return builder
  }

  makePlayer() {
    return new Player(this, 200, 300)
  }
}
