import { CHUNK_SIZE } from '../../../config.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { FILL_MAX } from '../../Matter/_Liquid.constants.ts'
import { matterType } from '../../Matter/_Matter.types.ts'
import { isLiquid } from '../../Matter/matter.ts'
import WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer
import WebGLTextureWrapper = Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper

const CHUNK_BYTES = CHUNK_SIZE * CHUNK_SIZE * 4

export class LiquidDensityRenderer extends SceneBound {
  readonly texture: Phaser.Textures.Texture
  private readonly textureWrapper: WebGLTextureWrapper
  private readonly pixels: Uint8Array
  private readonly partialUploadBuf: Uint8Array
  private readonly lastRenderGen: Uint8Array

  constructor(public scene: GameLevel, readonly enabled: boolean) {
    super(scene)
    const { width, height, chunkGrid } = scene.tilemap

    const [texture, wrapper] = this.scene.initGLTexture('liquid_density_texture', width, height)
    this.texture = texture
    this.textureWrapper = wrapper

    this.pixels = new Uint8Array(CHUNK_BYTES)
    this.partialUploadBuf = new Uint8Array(CHUNK_BYTES)
    this.lastRenderGen = new Uint8Array(chunkGrid.chunksWide * chunkGrid.chunksHigh)
  }

  update() {
    if (!this.enabled) return
    const { chunkGrid } = this.scene.tilemap
    let batchStarted = false

    for (let cy = 0; cy < chunkGrid.chunksHigh; cy++) {
      for (let cx = 0; cx < chunkGrid.chunksWide; cx++) {
        const idx = chunkGrid.idx(cx, cy)
        const gen = chunkGrid.getRenderGen(idx)
        if (gen === this.lastRenderGen[idx]) continue
        if (!batchStarted) {
          this.beginBatch()
          batchStarted = true
        }
        this.renderChunk(cx, cy)
        this.lastRenderGen[idx] = gen
      }
    }
    if (batchStarted) {
      this.endBatch()
    }
  }

  private beginBatch() {
    const gl = (this.scene.renderer as WebGLRenderer).gl
    gl.bindTexture(gl.TEXTURE_2D, this.textureWrapper.webGLTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
  }

  private endBatch() {
    const gl = (this.scene.renderer as WebGLRenderer).gl
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  private renderChunk(cx: number, cy: number) {
    const { tiles, fillLevels, width, height } = this.scene.tilemap
    const offX = cx * CHUNK_SIZE
    const offY = cy * CHUNK_SIZE
    const pixels = this.pixels

    pixels.fill(0)

    if (offX + CHUNK_SIZE <= width && offY + CHUNK_SIZE <= height) {
      for (let y = 0; y < CHUNK_SIZE; y++) {
        const flippedRow = (CHUNK_SIZE - 1 - y) * CHUNK_SIZE
        const srcRow = (offY + y) * width + offX
        for (let x = 0; x < CHUNK_SIZE; x++) {
          if (!isLiquid(matterType(tiles[srcRow + x]))) continue
          const pixIdx = (flippedRow + x) * 4
          pixels[pixIdx] = Math.min(255, Math.round(fillLevels[srcRow + x] / FILL_MAX * 255))
          pixels[pixIdx + 3] = 255
        }
      }
    } else {
      for (let y = 0; y < CHUNK_SIZE; y++) {
        const flippedRow = (CHUNK_SIZE - 1 - y) * CHUNK_SIZE
        const tileY = offY + y
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const tileX = offX + x
          if (tileX >= width || tileY >= height) continue
          const srcIdx = tileY * width + tileX
          if (!isLiquid(matterType(tiles[srcIdx]))) continue
          const pixIdx = (flippedRow + x) * 4
          pixels[pixIdx] = Math.min(255, Math.round(fillLevels[srcIdx] / FILL_MAX * 255))
          pixels[pixIdx + 3] = 255
        }
      }
    }

    this.uploadChunk(offX, offY)
  }

  private uploadChunk(x: number, y: number) {
    const { width: texW, height: texH } = this.scene.tilemap
    const uploadW = Math.min(CHUNK_SIZE, texW - x)
    const uploadH = Math.min(CHUNK_SIZE, texH - y)
    if (uploadW <= 0 || uploadH <= 0) return

    const glY = texH - y - uploadH
    const gl = (this.scene.renderer as WebGLRenderer).gl
    let src: Uint8Array

    if (uploadW === CHUNK_SIZE) {
      src = this.pixels.subarray((CHUNK_SIZE - uploadH) * CHUNK_SIZE * 4)
    } else {
      for (let row = 0; row < uploadH; row++) {
        const srcByte = (CHUNK_SIZE - uploadH + row) * CHUNK_SIZE * 4
        this.partialUploadBuf.set(this.pixels.subarray(srcByte, srcByte + uploadW * 4), row * uploadW * 4)
      }
      src = this.partialUploadBuf
    }

    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, glY, uploadW, uploadH, gl.RGBA, gl.UNSIGNED_BYTE, src)
  }

  protected onDestroy() {
    if (this.texture.manager) {
      this.texture.destroy()
    }
  }
}
