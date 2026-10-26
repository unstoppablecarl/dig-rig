import { PERMANENT, setSettled, WATER } from '../../lib/Matter/_Matter.types.ts'
import { Player } from '../../lib/Player/Player.ts'
import { ScaleLevelTexture } from '../../lib/Textures/ScaleLevelTexture.ts'
import { Tilemap } from '../../lib/Tilemap/Tilemap.ts'
import { TilemapBuilder } from '../../lib/Tilemap/TilemapBuilder.ts'
import { GameLevel } from '../GameLevel.ts'
import CanvasTexture = Phaser.Textures.CanvasTexture

// Repro for "a brushed water hill levels very slowly": a wide flat dry floor, plus an automatic
// pour that calls brushAddMatter exactly like a held brush (BrushInput's 100ms repeat timer), so
// the same hill forms every load and particle on/off (ENABLE_LIQUID_PARTICLES) can be compared
// on identical input. Brush more by hand on top of it as needed.
const MAP_WIDTH = 600
const MAP_HEIGHT = 400
const FLOOR_Y = 300

const POUR_X = MAP_WIDTH / 2
const POUR_HEIGHT_ABOVE_FLOOR = 40
const POUR_RADIUS = 6
const POUR_START_DELAY_MS = 1000
const POUR_INTERVAL_MS = 100
const POUR_DURATION_MS = 5000
// Unsettled water, same as what a brush paints.
const POUR_VALUE = setSettled(WATER, false)

export default class WaterHillTestLevel extends GameLevel {
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
    builder.setRect(0, FLOOR_Y, MAP_WIDTH, MAP_HEIGHT - FLOOR_Y, PERMANENT)
    builder.setBorder(2, PERMANENT)
    return builder
  }

  makePlayer() {
    return new Player(this, 60, FLOOR_Y - 20)
  }

  create() {
    super.create()

    this.time.delayedCall(POUR_START_DELAY_MS, () => {
      this.time.addEvent({
        delay: POUR_INTERVAL_MS,
        repeat: Math.round(POUR_DURATION_MS / POUR_INTERVAL_MS) - 1,
        callback: () => {
          this.matterEngine.brushAddMatter(POUR_VALUE, POUR_X, FLOOR_Y - POUR_HEIGHT_ABOVE_FLOOR, POUR_RADIUS)
        },
      })
    })
  }
}
