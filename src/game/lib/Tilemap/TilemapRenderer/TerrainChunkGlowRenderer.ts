import { CHUNK_SIZE } from '../../../config.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { MatterType } from '../_Matter-types.ts'
import type { Chunk, ChunkId } from '../Chunk.ts'
import WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer
import CanvasTexture = Phaser.Textures.CanvasTexture

// Glow pixel layout (little-endian Uint32: 0xAABBGGRR):
//   G channel = gradient intensity (255 at d=1, fades to 0 at GLOW_RADIUS+1)
//   R channel = 1px outline flag (255 only at d=1, else 0)
//   A = 0xFF always
const GLOW_EMPTY = 0xFF000000

// extended distance transform region
const GLOW_BYTES = CHUNK_SIZE * CHUNK_SIZE * 4

// Per-chunk state for CPU-side lerp transitions.
// Both buffers are allocated once per chunk on first render and reused indefinitely.
type ChunkGlowState = {
  // glow bytes at transition start
  prev: Uint8Array
  // target glow bytes
  current: Uint8Array
  startTime: number
  active: boolean
  // kept for offX/offY during updateGlowTransitions
  chunk: Chunk
}

export type TerrainChunkGlowRendererConfig = {
  readonly glowRadius: number,
  readonly glowEnabled: boolean,
  readonly glowTransitionAnimation: boolean,
  readonly glowTransitionMS: number,
}

export class TerrainChunkGlowRenderer extends SceneBound implements TerrainChunkGlowRendererConfig {
  readonly glowTexture: CanvasTexture

  private readonly glowUploadBuf: Uint8Array
  private readonly partialUploadBuf = new Uint8Array(GLOW_BYTES)
  private readonly distBuf: Uint8Array
  // Uint32 view of glowUploadBuf
  private readonly glowPixels: Uint32Array

  private readonly glowStates = new Map<ChunkId, ChunkGlowState>()

  readonly glowRadius: number
  readonly glowTransitionMS: number
  readonly glowEnabled: boolean
  readonly glowTransitionAnimation: boolean

  readonly EXT: number

  constructor(public scene: GameLevel, config: TerrainChunkGlowRendererConfig) {
    super(scene)
    const { width, height } = scene.tilemap

    this.glowTexture = scene.initCanvasTexture('terrain_glow', width, height)

    const buf = new ArrayBuffer(GLOW_BYTES)
    this.glowUploadBuf = new Uint8Array(buf)
    this.glowPixels = new Uint32Array(buf)
    this.glowRadius = config.glowRadius
    this.glowEnabled = config.glowEnabled
    this.glowTransitionAnimation = config.glowTransitionAnimation
    this.glowTransitionMS = config.glowTransitionMS

    this.EXT = CHUNK_SIZE + 2 * this.glowRadius

    this.distBuf = new Uint8Array(this.EXT * this.EXT)
  }

  renderChunk(chunk: Chunk) {
    if (!this.glowEnabled) return

    this.computeGlow(chunk)

    if (!this.glowTransitionAnimation) {
      this.upload(chunk.cx * CHUNK_SIZE, chunk.cy * CHUNK_SIZE)
      return
    }

    const state = this.glowStates.get(chunk.id)
    if (!state) {
      // First render — no previous state to transition from, upload immediately.
      this.upload(chunk.cx * CHUNK_SIZE, chunk.cy * CHUNK_SIZE)
      const current = new Uint8Array(GLOW_BYTES)
      current.set(this.glowUploadBuf)
      this.glowStates.set(chunk.id, {
        prev: new Uint8Array(GLOW_BYTES),
        current,
        startTime: 0,
        active: false,
        chunk,
      })
      return
    }

    // Capture the currently-displayed glow into prev.
    if (state.active) {
      // Mid-transition: lerp to the current displayed value in-place.
      const t = Math.min(1, (this.scene.time.now - state.startTime) / this.glowTransitionMS)
      for (let i = 0; i < GLOW_BYTES; i++) {
        state.prev[i] = (state.prev[i] + (state.current[i] - state.prev[i]) * t) | 0
      }
    } else {
      state.prev.set(state.current)
    }

    state.current.set(this.glowUploadBuf)
    state.startTime = this.scene.time.now
    state.active = true
    state.chunk = chunk
  }

  // Lerp active transitions each frame and upload the interpolated result.
  updateTransitions() {
    if (!this.glowEnabled) return
    if (!this.glowTransitionAnimation) return
    const now = this.scene.time.now
    for (const state of this.glowStates.values()) {
      if (!state.active) continue
      const t = Math.min(1, (now - state.startTime) / this.glowTransitionMS)
      const { prev, current } = state
      for (let i = 0; i < GLOW_BYTES; i++) {
        this.glowUploadBuf[i] = (prev[i] + (current[i] - prev[i]) * t) | 0
      }
      this.upload(state.chunk.cx * CHUNK_SIZE, state.chunk.cy * CHUNK_SIZE)
      if (t >= 1) state.active = false
    }
  }

  // ── Distance transform + glow pixel generation ─────────────────────────

  private computeGlow(chunk: Chunk) {
    const offX = chunk.cx * CHUNK_SIZE
    const offY = chunk.cy * CHUNK_SIZE
    const tilemap = this.scene.tilemap
    const dist = this.distBuf
    const GLOW_RADIUS = this.glowRadius
    const startX = offX - GLOW_RADIUS
    const startY = offY - GLOW_RADIUS
    const EXT = this.EXT

    // 1. Init: empty=0 (seed), solid=255 (infinity sentinel)
    for (let y = 0; y < EXT; y++) {
      for (let x = 0; x < EXT; x++) {
        dist[y * EXT + x] = tilemap.getTile(startX + x, startY + y) === MatterType.EMPTY ? 0 : 255
      }
    }

    // 2. Forward pass (TL→BR): 4-connected only (no diagonals) to avoid interior-corner artifacts
    for (let y = 0; y < EXT; y++) {
      for (let x = 0; x < EXT; x++) {
        let d = dist[y * EXT + x]
        if (d === 0) continue
        if (y > 0) d = Math.min(d, dist[(y - 1) * EXT + x] + 1)
        if (x > 0) d = Math.min(d, dist[y * EXT + (x - 1)] + 1)
        dist[y * EXT + x] = d
      }
    }

    // 3. Backward pass (BR→TL): 4-connected only
    for (let y = EXT - 1; y >= 0; y--) {
      for (let x = EXT - 1; x >= 0; x--) {
        let d = dist[y * EXT + x]
        if (d === 0) continue
        if (y < EXT - 1) d = Math.min(d, dist[(y + 1) * EXT + x] + 1)
        if (x < EXT - 1) d = Math.min(d, dist[y * EXT + (x + 1)] + 1)
        dist[y * EXT + x] = d
      }
    }

    // 4. Write glow pixels (bottom-up row order to match Phaser's flipY convention)
    const pixels = this.glowPixels
    pixels.fill(GLOW_EMPTY)
    for (let y = 0; y < CHUNK_SIZE; y++) {
      const flippedRow = (CHUNK_SIZE - 1 - y) * CHUNK_SIZE
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const d = dist[(y + GLOW_RADIUS) * EXT + (x + GLOW_RADIUS)]
        if (d === 0 || d > GLOW_RADIUS) continue
        const intensity = Math.floor(255 * (GLOW_RADIUS + 1 - d) / GLOW_RADIUS)
        const outlineFlag = d === 1 ? 255 : 0
        pixels[flippedRow + x] = (0xFF << 24) | (intensity << 8) | outlineFlag
      }
    }
  }

  private upload(x: number, y: number) {
    const { width: texW, height: texH } = this.scene.tilemap
    const uploadW = Math.min(CHUNK_SIZE, texW - x)
    const uploadH = Math.min(CHUNK_SIZE, texH - y)
    if (uploadW <= 0 || uploadH <= 0) return

    const glY = texH - y - uploadH
    let src: Uint8Array

    if (uploadW === CHUNK_SIZE) {
      src = this.glowUploadBuf.subarray((CHUNK_SIZE - uploadH) * CHUNK_SIZE * 4)
    } else {
      for (let row = 0; row < uploadH; row++) {
        const srcByte = (CHUNK_SIZE - uploadH + row) * CHUNK_SIZE * 4
        this.partialUploadBuf.set(this.glowUploadBuf.subarray(srcByte, srcByte + uploadW * 4), row * uploadW * 4)
      }
      src = this.partialUploadBuf
    }

    const gl = (this.scene.renderer as WebGLRenderer).gl
    const webGLTexture = (this.glowTexture.source[0] as any).glTexture.webGLTexture!
    gl.bindTexture(gl.TEXTURE_2D, webGLTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, glY, uploadW, uploadH, gl.RGBA, gl.UNSIGNED_BYTE, src)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  protected onDestroy() {
    if (this.glowTexture.manager) {
      this.glowTexture.destroy()
    }
  }
}
