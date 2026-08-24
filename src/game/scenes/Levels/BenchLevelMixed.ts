import { OIL, PERMANENT, SAND, SOLID } from '../../lib/Matter/_Matter.types.ts'
import { NO_MATTER_TANK_ID } from '../../lib/Matter/Tank/_MatterTank.types.ts'
import { Player } from '../../lib/Player/Player.ts'
import { ScaleLevelTexture } from '../../lib/Textures/ScaleLevelTexture.ts'
import { Tilemap } from '../../lib/Tilemap/Tilemap.ts'
import { TilemapBuilder } from '../../lib/Tilemap/TilemapBuilder.ts'
import { GameLevel } from '../GameLevel.ts'
import CanvasTexture = Phaser.Textures.CanvasTexture

// Fixed, deterministic "mixed" heavy-load scenario for _scripts/bench-sim.mjs
// — the gap case between BENCH (wide, ~11 columns touched) and BENCH_SHAFT
// (narrow, ~1 column touched): a wide unsettled oil block PLUS a separate
// narrow, tall, unsettled sand shaft in the same snapshot, columns
// non-overlapping and each confined to its own real chunk-columns. Built to
// stress-test SimWorkerPool's adaptive ENABLE_COLUMN_DISPATCH heuristic
// (>= poolSize distinct touched columns => column mode) — the aggregate
// touched-column count here is high enough (~12) to trigger column mode,
// but almost all of the shaft's ~120k tiles collapse onto the one real
// chunk-column it occupies, while the oil block's ~200k tiles spread across
// ~11 columns. If the heuristic only counts distinct columns (not how
// lopsided their sizes are), this is exactly the case where it should still
// pick column mode yet suffer a real imbalance from the shaft's oversized
// column — see memory `project-column-dispatch-prototype`.
const MAP_WIDTH = 1200
const MAP_HEIGHT = 3200
const OIL_BLOCK_WIDTH = 700
const OIL_BLOCK_HEIGHT = 280
const OIL_BLOCK_X = (MAP_WIDTH - OIL_BLOCK_WIDTH) / 2 // cx 3..14
const SHAFT_X = 1088 // cx 17 only — well clear of the oil block's columns
const SHAFT_WIDTH = 40
const SHAFT_TOP = 50
const FLOOR_HEIGHT = 150

export default class BenchLevelMixed extends GameLevel {
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
    builder.setRect(OIL_BLOCK_X, 50, OIL_BLOCK_WIDTH, OIL_BLOCK_HEIGHT, OIL, NO_MATTER_TANK_ID)
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
    return new Player(this, 100, 300)
  }
}
