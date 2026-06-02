import { FIRE_MODE_COLORS_RGB } from '../../../config/colors.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { FireMode } from '../../Player/_FireMode-types.ts'
import WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer
import CanvasTexture = Phaser.Textures.CanvasTexture

// RGB = fire mode color, A = intensity fading 1→0 over EFFECT_DURATION_MS.
// texSubImage2D with Uint8Array bypasses premultiplied-alpha (UNPACK_PREMULTIPLY_ALPHA_WEBGL
// defaults false), and texture2D in GLSL returns raw stored values, so A is safe to use.
const EFFECT_DURATION_MS = 1500

type EffectEntry = {
  startTime: number
  tx: number
  ty: number
  r: number
  g: number
  b: number
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

    // Plain Uint8Array (not Uint8ClampedArray): Chrome routes texSubImage2D(Uint8ClampedArray)
    // through glCopySubTextureCHROMIUM, which throws INVALID_VALUE at texture boundaries.
    this.effectUploadBuf = new Uint8Array(width * height * 4)
  }

  addEffect(tx: number, ty: number, value: FireMode, startTime: number = this.scene.time.now) {
    const { r, g, b } = FIRE_MODE_COLORS_RGB[value]
    const idx = ty * this.scene.tilemap.width + tx
    this.effectMap.set(idx, { startTime, tx, ty, r, g, b })
  }

  update() {
    if (!this.effectMap.size) return

    const { width, height } = this.scene.tilemap
    const now = this.scene.time.now
    const bytes = this.effectBuf
    let minX = width, maxX = 0, minY = height, maxY = 0

    for (const [key, { startTime, tx, ty, r, g, b }] of this.effectMap) {
      const elapsed = now - startTime
      const byteIdx = (ty * width + tx) * 4

      if (elapsed >= EFFECT_DURATION_MS) {
        bytes[byteIdx + 3] = 0
        this.effectMap.delete(key)
      } else {
        bytes[byteIdx] = r
        bytes[byteIdx + 1] = g
        bytes[byteIdx + 2] = b
        bytes[byteIdx + 3] = Math.floor((1 - elapsed / EFFECT_DURATION_MS) * 255)
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
