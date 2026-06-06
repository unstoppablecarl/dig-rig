import { Driller } from '../../lib/Entities/Driller.ts'
import { PERMANENT, SOLID } from '../../lib/Matter/_Matter-types.ts'
import { Player } from '../../lib/Player/Player.ts'
import { ScaleLevelTexture } from '../../lib/Textures/ScaleLevelTexture.ts'
import { Tilemap } from '../../lib/Tilemap/Tilemap.ts'
import { GameLevel } from '../GameLevel.ts'
import CanvasTexture = Phaser.Textures.CanvasTexture

export default class TestLevel extends GameLevel {
  private scaleLevelTexture: ScaleLevelTexture

  preload() {
    super.preload()
    this.scaleLevelTexture = new ScaleLevelTexture(this)
    this.scaleLevelTexture.preload()
    this.load.setPath('assets')
    this.loadPixelImage('crate', 'crate.png')
    this.loadPixelImage('enemy', 'enemy.png')

    this.preloadPlayer()
  }

  getTerrainTexture(tilemap: Tilemap): CanvasTexture {
    return this.scaleLevelTexture.generate(tilemap)
  }

  makeTileMap() {
    const tilemap = new Tilemap(
      this,
      2000,
      1000,
    )

    let ref = 600
    tilemap.setRect(0, ref - 100, tilemap.width, 500, SOLID)
    tilemap.setRect(200, ref - 160, 160, 60, SOLID)
    tilemap.setRect(230, ref - 200, 60, 60, SOLID)
    tilemap.setRect(450, ref - 220, 60, 60, SOLID)
    tilemap.setBorder(2, PERMANENT)

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

    const sprite = this.add.sprite(x, y, 'crate')

    this.layers.physicsObjects.add(sprite)
    this.matter.add.gameObject(sprite, crate)

    return crate
  }
}