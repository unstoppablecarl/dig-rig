import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { MatterType } from '../_Tilemap-types.ts'
import WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer
import CanvasTexture = Phaser.Textures.CanvasTexture

// Each mutable effect type gets its own channel so both can overlap on the same tile.
// Pixel layout (A always 255 to prevent premultiplied-alpha corruption):
//   R = destroy (EMPTY) intensity   0–255
//   G = create  (SOLID) intensity   0–255
//   A = 255 always
// PERMANENT tiles are immutable so they have no effect animation.
const EFFECT_DURATION_MS = 1500
const EFFECT_CHANNEL: Partial<Record<MatterType, number>> = {
  [MatterType.EMPTY]: 0, // R
  [MatterType.SOLID]: 1, // G
}

type EffectEntry = {
  startTime: number
  tx: number
  ty: number
  channel: number
}

export class TerrainEffectSystem extends SceneBound {
  readonly effectTexture: CanvasTexture

  private readonly effectBuf: Uint8Array
  private readonly effectUploadBuf: Uint8Array
  private readonly effectMap = new Map<number, EffectEntry>()

  constructor(public scene: GameLevel) {
    super(scene)
    const { width, height } = scene.tilemap
    this.effectTexture = this.scene.initCanvasTexture('terrain_effect_texture', width, height)

    this.effectBuf = new Uint8Array(width * height * 4)
    // Pre-fill A=255 so premultiplied-alpha never corrupts R/G/B intensity values
    for (let i = 3; i < this.effectBuf.length; i += 4) this.effectBuf[i] = 255

    // Plain Uint8Array (not Uint8ClampedArray): Chrome routes texSubImage2D(Uint8ClampedArray)
    // through glCopySubTextureCHROMIUM, which throws INVALID_VALUE at texture boundaries.
    this.effectUploadBuf = new Uint8Array(width * height * 4)
  }

  addEffect(tx: number, ty: number, value: MatterType, startTime: number = this.scene.time.now) {
    const channel = EFFECT_CHANNEL[value]
    if (channel === undefined) return
    const idx = ty * this.scene.tilemap.width + tx
    // Key encodes both position and channel so destroy and create expire independently
    const key = idx * 2 + channel
    this.effectMap.set(key, { startTime, tx, ty, channel })
  }

  update() {
    if (!this.effectMap.size) return

    const { width, height } = this.scene.tilemap
    const now = this.scene.time.now
    const bytes = this.effectBuf
    let minX = width, maxX = 0, minY = height, maxY = 0

    for (const [key, { startTime, tx, ty, channel }] of this.effectMap) {
      const elapsed = now - startTime
      const byteIdx = (ty * width + tx) * 4 + channel  // 0=R (destroy), 1=G (create)

      if (elapsed >= EFFECT_DURATION_MS) {
        bytes[byteIdx] = 0
        this.effectMap.delete(key)
      } else {
        bytes[byteIdx] = Math.floor(255 * (1 - elapsed / EFFECT_DURATION_MS))
      }

      if (tx < minX) minX = tx
      if (tx > maxX) maxX = tx
      if (ty < minY) minY = ty
      if (ty > maxY) maxY = ty
    }

    const bw = maxX - minX + 1
    const bh = maxY - minY + 1

    for (let row = 0; row < bh; row++) {
      const srcOff = ((minY + row) * width + minX) * 4
      const dstOff = (bh - 1 - row) * bw * 4
      this.effectUploadBuf.set(bytes.subarray(srcOff, srcOff + bw * 4), dstOff)
    }

    const gl = (this.scene.renderer as WebGLRenderer).gl
    const texture = (this.effectTexture.source[0] as any).glTexture.webGLTexture!
    const glY = this.scene.tilemap.height - minY - bh

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, minX, glY, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, this.effectUploadBuf)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  protected onDestroy() {
    if (this.effectTexture.manager) {
      this.effectTexture.destroy()
    }
  }
}
