import TextureManager = Phaser.Textures.TextureManager
import CanvasTexture = Phaser.Textures.CanvasTexture

export type PatternRenderer = {
  (x: number, y: number): number,
}

export type PatternStore = ReturnType<typeof makePatterns>

export function makePatterns(textures: TextureManager) {
  return {
    ROCK_PATTERN: makeFunctionalPattern(0x696969, 10, (x, y) => ((y * 3 + x * 5) % 8) / 8),
    IMG_PATTERN: makeImagePattern(textures, 'rock-tile'),
  }
}

function makeImagePattern(
  textures: TextureManager,
  key: string,
) {
  const img = textures.get(key).getSourceImage() as HTMLImageElement

  const size = img.width
  const canvasTexture = textures.createCanvas('canvas_' + key, img.width, img.height) as CanvasTexture

  canvasTexture.draw(0, 0, img)

  let context = canvasTexture.canvas.getContext('2d') as CanvasRenderingContext2D
  const imageData = context.getImageData(0, 0, img.width, img.height)
  canvasTexture.destroy()
  return makePatternRenderer(size, imageData)
}

function makeFunctionalPattern(
  baseColor: number,
  size: number,
  variationFunc: (x: number, y: number) => number,
) {
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = size
  tempCanvas.height = size
  const tempCtx = tempCanvas.getContext('2d') as CanvasRenderingContext2D
  const img = tempCtx.createImageData(size, size)
  const d = img.data

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let shade = variationFunc ? variationFunc(px, py) : 1.0
      const idx = (py * size + px) * 4
      d[idx] = Math.floor(((baseColor >> 16) & 255) * shade)
      d[idx + 1] = Math.floor(((baseColor >> 8) & 255) * shade)
      d[idx + 2] = Math.floor((baseColor & 255) * shade)
      d[idx + 3] = 255
    }
  }
  tempCtx.putImageData(img, 0, 0)
  const imageData = tempCtx.getImageData(0, 0, size, size)

  return makePatternRenderer(size, imageData)
}

function makePatternRenderer(size: number, imageData: ImageData): PatternRenderer {
  return (x: number, y: number): number => {
    const px = x % size
    const py = y % size
    const idx = (py * size + px) * 4
    const r = imageData.data[idx]
    const g = imageData.data[idx + 1]
    const b = imageData.data[idx + 2]
    return (r << 16) | (g << 8) | b
  }
}