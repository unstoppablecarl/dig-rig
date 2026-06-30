import { PERMANENT } from '../../lib/Matter/_Matter.types.ts'
import { Player } from '../../lib/Player/Player.ts'
import { textureToPixelData } from '../../lib/Textures/texture-util.ts'
import { Tilemap } from '../../lib/Tilemap/Tilemap.ts'
import { GameLevel } from '../GameLevel.ts'
import CanvasTexture = Phaser.Textures.CanvasTexture

export default class ImageSourceTestLevel extends GameLevel {
  registerEntities() {
    return []
  }

  private TERRAIN: string
  private PERMANENT: string
  private SOLID: string

  preload() {
    super.preload()

    this.load.setPath('level-data')

    this.TERRAIN = this.loadPrefixedPixelImage('terrain', 'terrain.png')
    this.PERMANENT = this.loadPrefixedPixelImage('permanent', 'permanent.png')
    this.SOLID = this.loadPrefixedPixelImage('solid', 'solid.png')

    this.preloadPlayer()
  }

  getTerrainTexture() {
    return this.textures.get(this.TERRAIN) as CanvasTexture
  }

  makeTileMap() {
    const solidData = textureToPixelData(this.textures, this.SOLID)
    const permanentData = textureToPixelData(this.textures, this.PERMANENT)

    const tilemap = Tilemap.makeFromSolidAndPermanentPixelData(this, solidData, permanentData)
    tilemap.setBorder(2, PERMANENT)

    return tilemap
  }

  makePlayer() {
    return new Player(this, 100, 300)
  }
}
