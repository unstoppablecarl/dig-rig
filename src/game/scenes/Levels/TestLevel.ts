import { Driller } from '../../lib/Entities/Driller.ts'
import { Player } from '../../lib/Player/Player.ts'
import { makeMultiImagePatternRenderer } from '../../lib/Textures/PatternRenderer.ts'
import { TerrainType, Tilemap } from '../../lib/TileMap/TileMap.ts'
import { GameLevel } from '../GameLevel.ts'

export default class TestLevel extends GameLevel {
  preload() {
    super.preload()

    this.load.setPath('assets')

    this.loadPixelImage('scale', 'tiles/scale.png')
    this.loadPixelImage('scale-2', 'tiles/scale2.png')

    this.loadPixelImage('enemy', 'enemy-2.png')

    this.preloadPlayer()
  }

  makeTileMapChunkPixelRenderer() {
    return makeMultiImagePatternRenderer(this.textures, this.tilemap, {
      'scale': 4,
      'scale-2': 1,
    })
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
    tilemap.setRect(450, 380, 60, 60, TerrainType.SOLID)

    return tilemap
  }

  makePlayer() {
    return new Player(this, 100, 300)
  }

  startLevel() {

    const driller = new Driller(this)
    driller.x = 150
    driller.y = 350

    this.entities.add(driller)
    this.createTestCrate(90, 50)
    this.createTestCrate(100, 0)

    this.createTestCrate(80, 100)
    this.createTestCrate(120, 100)
  }

  createTestCrate(x: number, y: number) {
    const crate = this.matter.add.rectangle(x, y, 20, 20, {
      friction: 10000,
      frictionStatic: 10000,
      restitution: 0,
      density: 0.001,
    })

    const sprite = this.add.rectangle(x, y, 20, 20, 0x8B4513)

    this.matter.add.gameObject(sprite, crate)

    return crate
  }
}