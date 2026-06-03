import { CHUNK_SIZE } from '../../../config.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { MatterTypeValues, SETTLED_FLAG, TILE_STATE_MASK } from '../../Matter/_Matter-types.ts'
import type { Chunk } from '../Chunk.ts'
import WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer
import WebGLTextureWrapper = Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper

// Mask pixel layout (little-endian Uint32: 0xAABBGGRR):
//   R = MatterType (0–255). G = SETTLED (0 or 255). B unused. A = 255.
//   Index = tile & TILE_STATE_MASK (type bits 0–7 + settled bit 8).
const MASK_MAP = new Uint32Array(512)
for (const type of MatterTypeValues) {
  MASK_MAP[type]                = 0xFF000000 | type
  MASK_MAP[type | SETTLED_FLAG] = 0xFF000000 | (0xFF << 8) | type
}

const CHUNK_BYTES = CHUNK_SIZE * CHUNK_SIZE * 4

export class TerrainChunkRenderer extends SceneBound {
  readonly maskTexture: Phaser.Textures.Texture
  private readonly maskWrapper: WebGLTextureWrapper

  private readonly pixels: Uint32Array
  private readonly chunkUploadBuf: Uint8Array
  private readonly partialUploadBuf = new Uint8Array(CHUNK_BYTES)

  constructor(public scene: GameLevel) {
    super(scene)
    const { width, height } = scene.tilemap

    const [texture, wrapper] = this.scene.initGLTexture('terrain_mask', width, height)
    this.maskTexture = texture
    this.maskWrapper = wrapper

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
    const mapWidth = tilemap.width

    if (offX + CHUNK_SIZE <= mapWidth && offY + CHUNK_SIZE <= tilemap.height) {
      // Interior chunk: no out-of-bounds tiles, skip getTile bounds check entirely.
      const tiles = tilemap.tiles
      for (let y = 0; y < CHUNK_SIZE; y++) {
        const flippedRow = (CHUNK_SIZE - 1 - y) * CHUNK_SIZE
        const srcRow = (offY + y) * mapWidth + offX
        for (let x = 0; x < CHUNK_SIZE; x++) {
          pixels[flippedRow + x] = MASK_MAP[tiles[srcRow + x] & TILE_STATE_MASK]
        }
      }
    } else {
      // Edge chunk: some coordinates may be out of bounds; getTile returns PERMANENT for those.
      for (let y = 0; y < CHUNK_SIZE; y++) {
        const flippedRow = (CHUNK_SIZE - 1 - y) * CHUNK_SIZE
        for (let x = 0; x < CHUNK_SIZE; x++) {
          pixels[flippedRow + x] = MASK_MAP[tilemap.getTile(offX + x, offY + y) & TILE_STATE_MASK]
        }
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
    gl.bindTexture(gl.TEXTURE_2D, this.maskWrapper.webGLTexture)
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
