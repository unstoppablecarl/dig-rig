import { makePixelData, type PixelData } from 'pixel-data-js'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { TerrainType } from '../TileMap.ts'
import WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer
import CanvasTexture = Phaser.Textures.CanvasTexture

// Effect pixel: R=intensity (0-255), G=colorIndex (0/128/255), B=0, A=255.
// A is always 255 to prevent WebGL premultiplied-alpha from corrupting the other channels.
const EFFECT_DURATION_MS = 1500
const EFFECT_COLOR_IDX: Record<TerrainType, number> = {
  [TerrainType.EMPTY]: 0,
  [TerrainType.SOLID]: 128,
  [TerrainType.PERMANENT]: 255,
}
const TERRAIN_EFFECT = 'terrain_effect_texture'

type EffectEntry = {
  colorBits: number
  startTime: number
  tx: number
  ty: number
}

export class TerrainEffectSystem extends SceneBound {
  readonly effectTexture: CanvasTexture

  // World-sized buffer for effect pixels (indexed by ty * width + tx)
  private readonly effectBuffer: PixelData

  // Reusable row-pack buffer for sub-region GPU uploads (max size = full world)
  private readonly effectUploadBuf: Uint8Array

  private effectMap = new Map<number, EffectEntry>()

  constructor(public scene: GameLevel) {
    super(scene)
    const { width, height } = scene.tilemap
    this.effectTexture = this.scene.initCanvasTexture(TERRAIN_EFFECT, width, height)
    this.effectBuffer = makePixelData(new ImageData(width, height))
    this.effectUploadBuf = new Uint8Array(width * height * 4)
  }

  addEffect(tx: number, ty: number, value: TerrainType, startTime: number = this.scene.time.now) {
    // A=255 always
    const a = 0xFF << 24
    // G encodes color index to avoid premultiplied-alpha corruption
    const g = EFFECT_COLOR_IDX[value] << 8

    const colorBits = a | g
    const idx = ty * this.scene.tilemap.width + tx
    this.effectMap.set(idx, { colorBits, startTime, tx, ty })
  }

  update() {
    if (!this.effectMap.size) return

    const { width, height } = this.scene.tilemap
    const now = this.scene.time.now
    const toDelete: number[] = []
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0

    for (const [idx, { colorBits, startTime, tx, ty }] of this.effectMap) {
      const elapsed = now - startTime
      if (elapsed >= EFFECT_DURATION_MS) {
        this.effectBuffer.data[idx] = 0
        toDelete.push(idx)
      } else {
        // R=intensity
        const r = Math.floor(255 * (1 - elapsed / EFFECT_DURATION_MS))
        this.effectBuffer.data[idx] = colorBits | r
      }

      if (tx < minX) minX = tx
      if (tx > maxX) maxX = tx
      if (ty < minY) minY = ty
      if (ty > maxY) maxY = ty
    }

    for (const idx of toDelete) this.effectMap.delete(idx)

    const bw = maxX - minX + 1
    const bh = maxY - minY + 1

    // Pack the bounding box into effectUploadBuf, flipping rows to match GL bottom-up convention.
    // Using a typed-array upload avoids Chrome's glCopySubTextureCHROMIUM boundary-check errors
    // that occur when a canvas-based texSubImage2D touches the exact edge of the texture.
    const src = this.effectBuffer.imageData.data
    for (let row = 0; row < bh; row++) {
      const srcOff = ((minY + row) * width + minX) * 4
      const dstOff = (bh - 1 - row) * bw * 4  // flip row for GL bottom-up convention
      this.effectUploadBuf.set(src.subarray(srcOff, srcOff + bw * 4), dstOff)
    }

    const gl = (this.scene.renderer as WebGLRenderer).gl
    const texture = (this.effectTexture.source[0] as any).glTexture.webGLTexture!

    // glY: matches Phaser's flipY=true initial upload, rows are already flipped in effectUploadBuf
    const glY = this.scene.tilemap.height - minY - bh
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, minX, glY, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, this.effectUploadBuf)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  destroy() {
    this.effectTexture?.destroy()
    super.destroy()
  }
}
