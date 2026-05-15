import { makePixelData } from 'pixel-data-js'
import { CHUNK_SIZE, GLOW_ENABLED } from '../../../config.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Chunk } from '../Chunk.ts'
import { TerrainType } from '../TileMap.ts'
import WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer
import CanvasTexture = Phaser.Textures.CanvasTexture
import NEAREST = Phaser.Textures.FilterMode.NEAREST

// All canvas pixels are little-endian Uint32: 0xAABBGGRR
// R channel = data value read by shader (.r component, 0.0–1.0)
const MASK_EMPTY = 0xFF000000 // R=0   → 0.00
const MASK_SOLID = 0xFF000080 // R=128 → ~0.50
const MASK_PERM  = 0xFF0000FF // R=255 → 1.00

// Glow texture: G=255 for solid pixels with at least one empty neighbor, 0 otherwise. A=255 always.
const GLOW_ON  = (0xFF << 24) | (255 << 8) // A=255, G=255
const GLOW_OFF = MASK_EMPTY                 // A=255, G=0

export class TerrainChunkRenderer extends SceneBound {
  readonly maskTexture: CanvasTexture
  readonly glowTexture: CanvasTexture

  // Reusable CHUNK_SIZE×CHUNK_SIZE buffer.
  // Rows are written bottom-up so the typed array can be uploaded directly
  // without UNPACK_FLIP_Y_WEBGL, avoiding Chrome's glCopySubTextureCHROMIUM errors.
  // chunkUploadBuf is a Uint8Array view of the same memory — Chrome routes
  // Uint8ClampedArray through glCopySubTextureCHROMIUM (like a canvas) but
  // Uint8Array goes through a direct copy path that doesn't trigger the error.
  private chunkBuffer: ReturnType<typeof makePixelData>
  private readonly chunkUploadBuf: Uint8Array
  // Scratch buffer for partial chunks (last row/column when tilemap isn't a CHUNK_SIZE multiple)
  private readonly partialUploadBuf = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * 4)

  constructor(public scene: GameLevel) {
    super(scene)
    const { width, height } = scene.tilemap
    const imageData = new ImageData(CHUNK_SIZE, CHUNK_SIZE)
    this.chunkBuffer = makePixelData(imageData)
    this.chunkUploadBuf = new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength)

    this.maskTexture = this.initTexture('terrain_mask', width, height)
    this.glowTexture = this.initTexture('terrain_glow', width, height)
  }

  private initTexture(key: string, width: number, height: number) {
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key)
    const texture = this.scene.textures.createCanvas(key, width, height)!
    texture.refresh()
    texture.source[0].setFilter(NEAREST)
    return texture
  }

  renderChunk(chunk: Chunk) {
    this.renderChunkMask(chunk)
    if (GLOW_ENABLED) this.renderChunkGlow(chunk)
  }

  // Upload chunkBuffer to a texture sub-region at world tile (x, y).
  // Clips to the texture boundary so partial edge chunks (when tilemap dimensions are
  // not exact CHUNK_SIZE multiples) don't produce negative offsets or overflow.
  private uploadChunk(texture: CanvasTexture, x: number, y: number) {
    const { width: texW, height: texH } = this.scene.tilemap
    const uploadW = Math.min(CHUNK_SIZE, texW - x)
    const uploadH = Math.min(CHUNK_SIZE, texH - y)
    if (uploadW <= 0 || uploadH <= 0) return

    // glY uses uploadH so the offset is valid even when the chunk is clipped at the bottom edge.
    const glY = texH - y - uploadH

    // In the bottom-up buffer the top uploadH world rows occupy the last uploadH buffer rows
    // (indices [CHUNK_SIZE-uploadH .. CHUNK_SIZE-1]). Extract the valid region.
    let src: Uint8Array
    if (uploadW === CHUNK_SIZE) {
      // Full width — the last uploadH rows are contiguous; pass a subarray view directly.
      src = this.chunkUploadBuf.subarray((CHUNK_SIZE - uploadH) * CHUNK_SIZE * 4)
    } else {
      // Partial width — pack rows into the scratch buffer column-clipped.
      for (let row = 0; row < uploadH; row++) {
        const srcByte = (CHUNK_SIZE - uploadH + row) * CHUNK_SIZE * 4
        this.partialUploadBuf.set(this.chunkUploadBuf.subarray(srcByte, srcByte + uploadW * 4), row * uploadW * 4)
      }
      src = this.partialUploadBuf
    }

    const gl = (this.scene.renderer as WebGLRenderer).gl
    const webGLTexture = (texture.source[0] as any).glTexture.webGLTexture!
    gl.bindTexture(gl.TEXTURE_2D, webGLTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, glY, uploadW, uploadH, gl.RGBA, gl.UNSIGNED_BYTE, src)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  private renderChunkMask(chunk: Chunk) {
    const pixels = this.chunkBuffer.data
    const tilemap = this.scene.tilemap
    const offX = chunk.cx * CHUNK_SIZE
    const offY = chunk.cy * CHUNK_SIZE

    for (let y = 0; y < CHUNK_SIZE; y++) {
      const flippedRow = (CHUNK_SIZE - 1 - y) * CHUNK_SIZE
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tile = tilemap.getTile(offX + x, offY + y)
        pixels[flippedRow + x] =
          tile === TerrainType.PERMANENT ? MASK_PERM  :
          tile === TerrainType.SOLID     ? MASK_SOLID :
          MASK_EMPTY
      }
    }

    this.uploadChunk(this.maskTexture, offX, offY)
  }

  private renderChunkGlow(chunk: Chunk) {
    const pixels = this.chunkBuffer.data
    pixels.fill(MASK_EMPTY)

    const tilemap = this.scene.tilemap
    const offX = chunk.cx * CHUNK_SIZE
    const offY = chunk.cy * CHUNK_SIZE

    for (let y = 0; y < CHUNK_SIZE; y++) {
      const flippedRow = (CHUNK_SIZE - 1 - y) * CHUNK_SIZE
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tx = offX + x
        const ty = offY + y
        if (tilemap.getTile(tx, ty) !== TerrainType.EMPTY) {
          pixels[flippedRow + x] = this.innerGlowPixel(tx, ty)
        }
      }
    }

    this.uploadChunk(this.glowTexture, offX, offY)
  }

  // 1px outline: solid tiles with at least one empty neighbor glow at full intensity.
  private innerGlowPixel(tx: number, ty: number): number {
    const tilemap = this.scene.tilemap
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        if (tilemap.getTile(tx + dx, ty + dy) === TerrainType.EMPTY) return GLOW_ON
      }
    }
    return GLOW_OFF
  }

  destroy() {
    this.maskTexture?.destroy()
    this.glowTexture?.destroy()
    super.destroy()
  }
}
