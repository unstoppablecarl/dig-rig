import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Position } from '../../types.ts'
import { randomArrayIndex, randomArrayValue } from '../Random/rng.ts'
import { Tilemap } from '../Tilemap/Tilemap.ts'
import { makePatternTerrainTexture } from './makePatternTerrainTexture.ts'
import { makeMultiImagePatternRenderer } from './PatternRenderer.ts'
import CanvasTexture = Phaser.Textures.CanvasTexture
import NEAREST = Phaser.Textures.NEAREST

export class ScaleLevelTexture {
  constructor(
    readonly scene: GameLevel,
    readonly rng: () => number = Math.random,
  ) {

  }

  preload() {
    const scene = this.scene

    scene.load.setPath('assets')

    for (const [id, url] of Object.entries(patches)) {
      scene.loadPixelImage(id, url)
    }

    scene.load.setPath('assets/tiles')

    scene.loadPixelImage('scale1', 'scale/scale1.png')
    scene.loadPixelImage('scale2', 'scale/scale2.png')
    scene.loadPixelImage('scale3', 'scale/scale3.png')
    scene.loadPixelImage('scale4', 'scale/scale4.png')
    scene.loadPixelImage('scale5', 'scale/scale5.png')
    scene.loadPixelImage('scale6', 'scale/scale6.png')
    scene.loadPixelImage('scale7', 'scale/scale7.png')
    scene.loadPixelImage('scale8', 'scale/scale8.png')
    scene.loadPixelImage('scale9', 'scale/scale9.png')
    scene.loadPixelImage('scale10', 'scale/scale10.png')
    scene.loadPixelImage('scale2-1', 'scale/scale2-1.png')
    scene.loadPixelImage('scale2-2', 'scale/scale2-2.png')
    scene.loadPixelImage('scale2-3', 'scale/scale2-3.png')

  }

  generate(tilemap: Tilemap): CanvasTexture {
    const texture = makeMultiImagePatternRenderer(this.scene.textures, tilemap, {
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
    const result = makePatternTerrainTexture(this.scene, texture)

    const id = Object.keys(patches)[0]
    const img = this.scene.textures.get(id).getSourceImage() as HTMLImageElement

    const textureChunksWidth = Math.ceil(tilemap.width / img.width)
    const textureChunksHeight = Math.ceil(tilemap.height / img.height)

    const PATCH_COUNT = 1000

    for (let i = 0; i < PATCH_COUNT; i++) {
      this.placeRandomScalePatch(textureChunksWidth, textureChunksHeight, img.width, img.height, result)
    }

    result.refresh()
    result.source[0].setFilter(NEAREST)

    return result
  }

  randomScalePosition(): Position {
    const index = randomArrayIndex(SCALE_COORDS, this.rng)
    return {
      x: SCALE_COORDS[index][0],
      y: SCALE_COORDS[index][1],
    }
  }

  getRandomScalePatch() {
    const ids = Object.keys(patches)
    const id = randomArrayValue(ids)
    return this.scene.textures.get(id).getSourceImage() as HTMLImageElement
  }

  placeRandomScalePatch(textureChunksWidth: number, textureChunksHeight: number, tileWidth: number, tileHeight: number, target: CanvasTexture) {
    const patch = this.getRandomScalePatch()
    const pos = this.randomScalePosition()

    const x = Math.floor(this.rng() * textureChunksWidth)
    const y = Math.floor(this.rng() * textureChunksHeight)

    const px = x * tileWidth + pos.x
    const py = y * tileHeight + pos.y
    target.context.drawImage(patch, px, py)

  }
}

const SCALE_COORDS = [
  [0, 0],

  [3, 3],
  [8, 2],
  [13, 1],

  [1, 7],
  [6, 7],
  [11, 5],
  [16, 4],

  [4, 10],
  [9, 9],
  [14, 8],

  [2, 14],
  [7, 13],
  [12, 12],
  [17, 11],

  [5, 17],
  [10, 16],
  [15, 15],
]

const _patches = import.meta.glob('../../../../public/assets/tiles/scale/patches/*.png')
const patches = Object.fromEntries(Object.keys(_patches).map((p, index) => {
  const id = p.replace('../../../../public/assets/', '')
  return ['scale_patch_' + index, id]
}))
