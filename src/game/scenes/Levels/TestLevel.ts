import { Driller } from '../../lib/Entities/Driller.ts'
import { Player } from '../../lib/Player/Player.ts'
import { makeMultiImagePatternRenderer } from '../../lib/Textures/PatternRenderer.ts'
import { TerrainType, Tilemap } from '../../lib/TileMap/TileMap.ts'
import { GameLevel } from '../GameLevel.ts'

export default class TestLevel extends GameLevel {
  preload() {
    super.preload()

    this.load.setPath('assets')

    this.loadPixelImage('scale1', 'tiles/scale/scale1.png')
    this.loadPixelImage('scale2', 'tiles/scale/scale2.png')
    this.loadPixelImage('scale3', 'tiles/scale/scale3.png')
    this.loadPixelImage('scale4', 'tiles/scale/scale4.png')
    this.loadPixelImage('scale5', 'tiles/scale/scale5.png')
    this.loadPixelImage('scale6', 'tiles/scale/scale6.png')
    this.loadPixelImage('scale7', 'tiles/scale/scale7.png')
    this.loadPixelImage('scale8', 'tiles/scale/scale8.png')
    this.loadPixelImage('scale9', 'tiles/scale/scale9.png')
    this.loadPixelImage('scale10', 'tiles/scale/scale10.png')
    this.loadPixelImage('scale2-1', 'tiles/scale/scale2-1.png')
    this.loadPixelImage('scale2-2', 'tiles/scale/scale2-2.png')
    this.loadPixelImage('scale2-3', 'tiles/scale/scale2-3.png')

    this.loadPixelImage('enemy', 'enemy-2.png')

    this.preloadPlayer()
  }

  makeTileMapChunkPixelRenderer() {
    return makeMultiImagePatternRenderer(this.textures, this.tilemap, {
      'scale1': 50,
      'scale2': 1,
      'scale3': 1,
      'scale4': 2,
      'scale5': 6,
      'scale6': 5,
      'scale7': 4,
      'scale8': 3,
      'scale9': 3,
      'scale10': 3,
      'scale2-1': 1,
      'scale2-2': 1,
      'scale2-3': 1,
    })
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

  startLevel() {

    const driller = new Driller(this)
    driller.x = 150
    driller.y = 350

    this.entities.add(driller)
    this.makeTestCrate(90, 50)
    this.makeTestCrate(100, 0)

    this.makeTestCrate(80, 100)
    this.makeTestCrate(120, 100)
  }

  makeTestCrate(x: number, y: number) {
    const crate = this.matter.add.rectangle(x, y, 20, 20, {
      friction: 10000,
      frictionStatic: 10000,
      restitution: 0,
      density: 0.001,
    })

    const sprite = this.add.rectangle(x, y, 20, 20, 0x8B4513)

    this.layers.physicsObjects.add(sprite)
    this.matter.add.gameObject(sprite, crate)

    return crate
  }
}