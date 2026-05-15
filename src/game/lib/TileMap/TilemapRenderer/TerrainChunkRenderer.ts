import { makePixelData } from 'pixel-data-js'
import { CHUNK_SIZE, GLOW_ENABLED, GLOW_RADIUS } from '../../../config.ts'
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
const MASK_PERM = 0xFF0000FF // R=255 → 1.00

// Extended region for the distance transform: chunk + GLOW_RADIUS border on all sides.
// The border ensures tiles near chunk edges get correct distances from empty tiles in
// neighboring chunks without a separate cross-chunk pass.
const EXT = CHUNK_SIZE + 2 * GLOW_RADIUS

export class TerrainChunkRenderer extends SceneBound {
  readonly maskTexture: CanvasTexture
  readonly glowTexture: CanvasTexture

  private chunkBuffer: ReturnType<typeof makePixelData>
  private readonly chunkUploadBuf: Uint8Array
  private readonly partialUploadBuf = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * 4)

  // Reusable distance-transform buffer covering the EXT×EXT extended region.
  private readonly distBuf = new Uint8Array(EXT * EXT)

  constructor(public scene: GameLevel) {
    super(scene)
    const { width, height } = scene.tilemap

    this.maskTexture = this.initTexture('terrain_mask', width, height)
    this.glowTexture = this.initTexture('terrain_glow', width, height)

    const imageData = new ImageData(CHUNK_SIZE, CHUNK_SIZE)
    this.chunkBuffer = makePixelData(imageData)
    this.chunkUploadBuf = new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength)
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
  // Clips partial edge chunks (when tilemap dimensions aren't CHUNK_SIZE multiples)
  // so glY is never negative and xoffset + width never exceeds texture width.
  private uploadChunk(texture: CanvasTexture, x: number, y: number) {
    const { width: texW, height: texH } = this.scene.tilemap
    const uploadW = Math.min(CHUNK_SIZE, texW - x)
    const uploadH = Math.min(CHUNK_SIZE, texH - y)
    if (uploadW <= 0 || uploadH <= 0) return

    const glY = texH - y - uploadH

    let src: Uint8Array
    if (uploadW === CHUNK_SIZE) {
      // Full width — last uploadH rows of the bottom-up buffer are contiguous.
      src = this.chunkUploadBuf.subarray((CHUNK_SIZE - uploadH) * CHUNK_SIZE * 4)
    } else {
      // Partial width — pack rows into scratch buffer with column clipping.
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
          tile === TerrainType.PERMANENT ? MASK_PERM :
            tile === TerrainType.SOLID ? MASK_SOLID :
              MASK_EMPTY
      }
    }

    this.uploadChunk(this.maskTexture, offX, offY)
  }

  private renderChunkGlow(chunk: Chunk) {
    const offX = chunk.cx * CHUNK_SIZE
    const offY = chunk.cy * CHUNK_SIZE
    const tilemap = this.scene.tilemap
    const dist = this.distBuf

    // ── 1. Initialise the EXT×EXT distance buffer ──────────────────────────
    // Empty tiles are seeds (distance 0). All others start at 255 (≡ infinity;
    // safe because the maximum reachable distance inside EXT×EXT is EXT-1 ≈ 83).
    const startX = offX - GLOW_RADIUS
    const startY = offY - GLOW_RADIUS
    for (let y = 0; y < EXT; y++) {
      for (let x = 0; x < EXT; x++) {
        dist[y * EXT + x] = tilemap.getTile(startX + x, startY + y) === TerrainType.EMPTY ? 0 : 255
      }
    }

    // ── 2. Forward pass (top-left → bottom-right) ──────────────────────────
    // Each solid tile inherits the minimum distance from the four already-visited
    // neighbours (above-left, above, above-right, left) plus one step.
    for (let y = 0; y < EXT; y++) {
      for (let x = 0; x < EXT; x++) {
        let d = dist[y * EXT + x]
        if (d === 0) continue
        if (y > 0) {
          if (x > 0) d = Math.min(d, dist[(y - 1) * EXT + (x - 1)] + 1)
          d = Math.min(d, dist[(y - 1) * EXT + x] + 1)
          if (x < EXT - 1) d = Math.min(d, dist[(y - 1) * EXT + (x + 1)] + 1)
        }
        if (x > 0) d = Math.min(d, dist[y * EXT + (x - 1)] + 1)
        dist[y * EXT + x] = d
      }
    }

    // ── 3. Backward pass (bottom-right → top-left) ─────────────────────────
    // Covers seeds that are below or to the right of the solid tile — the cases
    // the forward pass cannot reach.
    for (let y = EXT - 1; y >= 0; y--) {
      for (let x = EXT - 1; x >= 0; x--) {
        let d = dist[y * EXT + x]
        if (d === 0) continue
        if (y < EXT - 1) {
          if (x < EXT - 1) d = Math.min(d, dist[(y + 1) * EXT + (x + 1)] + 1)
          d = Math.min(d, dist[(y + 1) * EXT + x] + 1)
          if (x > 0) d = Math.min(d, dist[(y + 1) * EXT + (x - 1)] + 1)
        }
        if (x < EXT - 1) d = Math.min(d, dist[y * EXT + (x + 1)] + 1)
        dist[y * EXT + x] = d
      }
    }

    // ── 4. Write gradient intensities into the chunk glow buffer ───────────
    // The center CHUNK_SIZE×CHUNK_SIZE region of distBuf maps 1:1 to the chunk.
    // Tiles with distance ≤ GLOW_RADIUS get a G-channel intensity proportional
    // to how close they are to the nearest empty tile.
    const pixels = this.chunkBuffer.data
    pixels.fill(MASK_EMPTY)

    for (let y = 0; y < CHUNK_SIZE; y++) {
      const flippedRow = (CHUNK_SIZE - 1 - y) * CHUNK_SIZE
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const d = dist[(y + GLOW_RADIUS) * EXT + (x + GLOW_RADIUS)]
        if (d === 0 || d > GLOW_RADIUS) continue
        // G channel: gradient intensity (255 at d=1, fades to 0 at GLOW_RADIUS+1)
        const intensity = Math.floor(255 * (GLOW_RADIUS + 1 - d) / GLOW_RADIUS)
        // R channel: 1px outline flag — only set for the immediate border (d=1)
        const outlineFlag = d === 1 ? 255 : 0
        pixels[flippedRow + x] = (0xFF << 24) | (intensity << 8) | outlineFlag
      }
    }

    this.uploadChunk(this.glowTexture, offX, offY)
  }

  protected onDestroy() {
    this.maskTexture.destroy()
    this.glowTexture.destroy()
  }
}
