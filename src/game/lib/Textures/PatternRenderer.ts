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
  let keys = Object.keys(textureWeights)
  const { width, height, images } = makeMultiImagePattern(textures, keys)

  const imgTilesWidth = Math.ceil(tilemap.width / width!)
  const imgTilesHeight = Math.ceil(tilemap.height / height!)

  const imagesArr = Object.values(images)
  const length = imgTilesWidth * imgTilesHeight

  const get = createWeightedRandom(
    keys.map((_v, index) => index),
    Object.values(textureWeights),
  )

  const idxToTextureIndex = new Uint32Array(length)
  for (const index in idxToTextureIndex) {
    idxToTextureIndex[index] = get()
  }

  return (x: number, y: number): number => {
    const tx = Math.ceil(x / width)
    const ty = Math.ceil(y / height)

    const textureIndex = idxToTextureIndex[ty * imgTilesWidth + tx]!
    const data32 = imagesArr[textureIndex].data

    const px = x % width
    const py = y % width
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
  images: Record<string, PixelData>
} {

  let width: number | null = null
  let height: number | null = null

  const images: Record<string, PixelData> = {}

  for (const key of keys) {
    let pixelData = textureToPixelData(textures, key)
    if (width === null || height === null) {
      width = pixelData.w
      height = pixelData.h
    } else {
      if (width !== pixelData.w || height !== pixelData.h) {
        throw new Error(`All textures must be the same size`)
      }
    }
    images[key] = pixelData
  }

  return {
    width: width!,
    height: height!,
    images,
  }
}