import { CHUNK_SIZE } from '../../../config.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { TerrainType } from '../_Tilemap-types.ts'
import type { Chunk } from '../Chunk.ts'
import WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer
import CanvasTexture = Phaser.Textures.CanvasTexture

// Mask pixel layout (little-endian Uint32: 0xAABBGGRR):
//   R ≈ 0.00 → EMPTY, R ≈ 0.50 → SOLID, R = 1.00 → PERMANENT
const MASK_EMPTY = 0xFF000000
const MASK_SOLID = 0xFF000080
const MASK_PERM = 0xFF0000FF

const CHUNK_BYTES = CHUNK_SIZE * CHUNK_SIZE * 4

export class TerrainChunkRenderer extends SceneBound {
  readonly maskTexture: CanvasTexture

  private readonly pixels: Uint32Array
  private readonly chunkUploadBuf: Uint8Array
  private readonly partialUploadBuf = new Uint8Array(CHUNK_BYTES)

  constructor(public scene: GameLevel) {
    super(scene)
    const { width, height } = scene.tilemap

    this.maskTexture = this.scene.initCanvasTexture('terrain_mask', width, height)

    const buf = new ArrayBuffer(CHUNK_BYTES)
    this.pixels = new Uint32Array(buf)
    // Plain Uint8Array (not Uint8ClampedArray): Chrome routes texSubImage2D(Uint8ClampedArray)
    // through glCopySubTextureCHROMIUM, which throws INVALID_VALUE at texture boundaries.
    this.chunkUploadBuf = new Uint8Array(buf)
  }

  renderChunk(chunk: Chunk) {
    const pixels = this.pixels
    const tilemap = this.scene.tilemap
    const offX = chunk.cx * CHUNK_SIZE
    const offY = chunk.cy * CHUNK_SIZE

    for (let y = 0; y < CHUNK_SIZE; y++) {
      const flippedRow = (CHUNK_SIZE - 1 - y) * CHUNK_SIZE
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tile = tilemap.getTile(offX + x, offY + y)
        pixels[flippedRow + x] =
          tile === TerrainType.PERMANENT ? MASK_PERM :
            tile === TerrainType.SOLID ? MASK_SOLID :
              MASK_EMPTY
      }
    }

    this.uploadMask(offX, offY)
  }

  private uploadMask(x: number, y: number) {
    const { width: texW, height: texH } = this.scene.tilemap
    const uploadW = Math.min(CHUNK_SIZE, texW - x)
    const uploadH = Math.min(CHUNK_SIZE, texH - y)
    if (uploadW <= 0 || uploadH <= 0) return

    const glY = texH - y - uploadH
    let src: Uint8Array

    if (uploadW === CHUNK_SIZE) {
      src = this.chunkUploadBuf.subarray((CHUNK_SIZE - uploadH) * CHUNK_SIZE * 4)
    } else {
      for (let row = 0; row < uploadH; row++) {
        const srcByte = (CHUNK_SIZE - uploadH + row) * CHUNK_SIZE * 4
        this.partialUploadBuf.set(this.chunkUploadBuf.subarray(srcByte, srcByte + uploadW * 4), row * uploadW * 4)
      }
      src = this.partialUploadBuf
    }

    const gl = (this.scene.renderer as WebGLRenderer).gl
    const webGLTexture = (this.maskTexture.source[0] as any).glTexture.webGLTexture!
    gl.bindTexture(gl.TEXTURE_2D, webGLTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, glY, uploadW, uploadH, gl.RGBA, gl.UNSIGNED_BYTE, src)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  protected onDestroy() {
    if (this.maskTexture.manager) {
      this.maskTexture.destroy()
    }
  }
}
