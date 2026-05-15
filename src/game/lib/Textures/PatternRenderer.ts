import { type PixelData } from 'pixel-data-js'
import { createWeightedRandom } from '../Random/rng'
import type { Tilemap } from '../TileMap/TileMap.ts'
import type { PatternRenderer } from './_pattern-types.ts'
import { textureToPixelData } from './texture-util'
import TextureManager = Phaser.Textures.TextureManager

export function makeImagePatternRenderer(textures: TextureManager, texture: string): PatternRenderer {
  const pixelData = textureToPixelData(textures, texture)
  const { w, h, data } = pixelData
  return (x: number, y: number): number => {
    const px = x % w
    const py = y % h
    const idx = py * w + px

    const color = data[idx]

    return ((color & 0xFF) << 16) | (color & 0xFF00) | ((color >> 16) & 0xFF)
  }
}

export function makeMultiImagePatternRenderer(textures: TextureManager, tilemap: Tilemap, textureWeights: Record<string, number>): PatternRenderer {
  const keys = Object.keys(textureWeights)
  const { width, height, images } = makeMultiImagePattern(textures, keys)

  const imgTilesWidth = Math.ceil(tilemap.width / width)
  const imgTilesHeight = Math.ceil(tilemap.height / height)
  const length = imgTilesWidth * imgTilesHeight

  const get = createWeightedRandom(
    keys.map((_v, index) => index),
    Object.values(textureWeights),
  )

  const idxToTextureIndex = new Uint32Array(length)
  for (let i = 0; i < idxToTextureIndex.length; i++) {
    idxToTextureIndex[i] = get()
  }

  return (x: number, y: number): number => {
    const tx = Math.floor(x / width)
    const ty = Math.floor(y / height)

    const textureIndex = idxToTextureIndex[ty * imgTilesWidth + tx]!
    const data32 = images[textureIndex].data

    const px = x % width
    const py = y % height
    const idx = py * width + px

    const color = data32[idx]

    return ((color & 0xFF) << 16) | (color & 0xFF00) | ((color >> 16) & 0xFF)
  }
}

function makeMultiImagePattern(
  textures: TextureManager,
  keys: string[],
): {
  width: number,
  height: number,
  images: PixelData[]
} {
  if (keys.length === 0) throw new Error('textureWeights must not be empty')

  const images: PixelData[] = keys.map(key => textureToPixelData(textures, key))
  const { w: width, h: height } = images[0]

  for (let i = 1; i < images.length; i++) {
    if (images[i].w !== width || images[i].h !== height) {
      throw new Error('All textures must be the same size')
    }
  }

  return { width, height, images }
}