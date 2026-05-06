import { makePixelData } from 'pixel-data-js'
import CanvasTexture = Phaser.Textures.CanvasTexture
import TextureManager = Phaser.Textures.TextureManager

export function textureToPixelData(textures: TextureManager, key: string) {
  const img = textures.get(key).getSourceImage() as HTMLImageElement
  const canvasTexture = textures.createCanvas('canvas_' + key, img.width, img.height) as CanvasTexture

  canvasTexture.draw(0, 0, img)

  let context = canvasTexture.canvas.getContext('2d') as CanvasRenderingContext2D
  const imageData = context.getImageData(0, 0, img.width, img.height)
  canvasTexture.destroy()

  return makePixelData(imageData)
}