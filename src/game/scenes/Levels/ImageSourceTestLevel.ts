import { Player } from '../../lib/Player/Player.ts'
import { textureToPixelData } from '../../lib/Textures/texture-util.ts'
import { Tilemap } from '../../lib/TileMap/TileMap.ts'
import { GameLevel } from '../GameLevel.ts'

export default class ImageSourceTestLevel extends GameLevel {
  preload() {
    super.preload()

    this.load.setPath('assets/level-data')

    this.loadPixelImage('terrain', 'terrain.png')

    this.loadPixelImage('permanent', 'permanent.png')
    this.loadPixelImage('solid', 'solid.png')

    this.load.setPath('assets')
    this.preloadPlayer()
  }

  getTerrainTexture() {
    return this.textures.get('terrain')
  }

  makeTileMap() {
    const solidData = textureToPixelData(this.textures, 'solid')
    const permanentData = textureToPixelData(this.textures, 'permanent')

    return Tilemap.makeFromPixelData(this, solidData, permanentData)
  }

  makePlayer() {
    return new Player(this, 100, 300)
  }
}
