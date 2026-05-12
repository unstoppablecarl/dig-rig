import { GameObjects } from 'phaser'
import { CHUNK_SIZE, DRAW_CHUNKS_DEBUG, TERRAIN_TYPE_TRANSITION_COLORS } from '../../config.ts'
import { shiftColorValue } from '../../helpers/colors.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { type Chunk, ChunkType } from './Chunk.ts'
import { TerrainType } from './TileMap.ts'
import Graphics = GameObjects.Graphics
import Layer = GameObjects.Layer
import Image = Phaser.GameObjects.Image
import CanvasTexture = Phaser.Textures.CanvasTexture
import NEAREST = Phaser.Textures.FilterMode.NEAREST

export class TileMapChunkRenderer extends SceneBound {
  public visibleCount: number

  private masterTexture: CanvasTexture
  private masterImage: Image

  // reusable per-chunk pixel buffer
  private chunkBuffer = new ImageData(CHUNK_SIZE, CHUNK_SIZE)
  private chunkPixels = new Uint32Array(this.chunkBuffer.data.buffer)

  private chunkDebugGraphics = new Map<Chunk, Graphics>()
  private visibleChunks = new Set<Chunk>()
  private prevVisibleChunks = new Set<Chunk>()

  private layer: Layer
  private debugLayer: Layer

  private changedChunks = new Set<Chunk>()

  public constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    this.scene = scene
    this.layer = scene.layers.terrain
    this.debugLayer = scene.layers.terrainDebug

    const { width, height } = scene.tilemap
    this.masterTexture = scene.textures.createCanvas('terrain_world', width, height)!
    this.masterImage = scene.add.image(0, 0, 'terrain_world').setOrigin(0, 0)
    this.layer.add(this.masterImage)
  }

  render() {
    const changedChunks = this.changedChunks
    changedChunks.clear()

    const cam = this.scene.cameras.main
    const view = cam.worldView
    const margin = 1.25

    const viewRadiusX = Math.ceil(view.width  / 2 / CHUNK_SIZE * margin)
    const viewRadiusY = Math.ceil(view.height / 2 / CHUNK_SIZE * margin)

    const cxCenter = Math.floor(cam.midPoint.x / CHUNK_SIZE)
    const cyCenter = Math.floor(cam.midPoint.y / CHUNK_SIZE)

    this.visibleChunks.clear()

    const chunkManager = this.scene.tilemap.chunkManager
    const { width, height } = chunkManager

    // Pass 1: collect visible dirty chunks
    for (let dy = -viewRadiusY; dy <= viewRadiusY; dy++) {
      for (let dx = -viewRadiusX; dx <= viewRadiusX; dx++) {
        const cx = cxCenter + dx
        const cy = cyCenter + dy
        if (cx < 0 || cy < 0 || cx > width - 1 || cy > height - 1) continue
        const chunk = chunkManager.getChunk(cx, cy)
        if (!chunk) continue

        this.visibleChunks.add(chunk)
        if (chunk.renderDirty) changedChunks.add(chunk)
      }
    }

    // Pass 2: update hasAny* neighbor flags — chunk.type is always current via solidTileCount
    for (const chunk of changedChunks) {
      let anyEmpty = false
      let anyFull = false
      let anyPartial = false
      const { cx, cy } = chunk
      outer:
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue
          const neighbor = chunkManager.getChunk(cx + dx, cy + dy)
          if (!neighbor) continue
          if (neighbor.type === ChunkType.EMPTY) anyEmpty = true
          else if (neighbor.type === ChunkType.FULL) anyFull = true
          else anyPartial = true
          if (anyEmpty && anyFull && anyPartial) break outer
        }
      }
      chunk.hasAnyEmptyNeighbors = anyEmpty
      chunk.hasAnyFullNeighbors = anyFull
      chunk.hasAnyPartialNeighbors = anyPartial
    }

    // Pass 3: render dirty chunks into master canvas
    for (const chunk of changedChunks) {
      this.renderChunk(chunk)
    }

    // Upload master canvas to GPU once if anything changed
    if (changedChunks.size > 0) {
      this.masterTexture.refresh()
      this.masterTexture.source[0].setFilter(NEAREST)
    }

    // Pass 4: debug only
    let renderedCount = 0
    if (DRAW_CHUNKS_DEBUG) {
      for (const chunk of this.visibleChunks) {
        if (chunk.type !== ChunkType.EMPTY) renderedCount++
        this.getDebugGraphics(chunk).setVisible(chunk.type !== ChunkType.EMPTY)
      }
      for (const chunk of this.prevVisibleChunks) {
        if (!this.visibleChunks.has(chunk)) {
          this.chunkDebugGraphics.get(chunk)?.setVisible(false)
        }
      }
      ;[this.visibleChunks, this.prevVisibleChunks] = [this.prevVisibleChunks, this.visibleChunks]
      this.visibleChunks.clear()
    }

    this.visibleCount = renderedCount
  }

  private renderChunk(chunk: Chunk): void {
    if (chunk.type === ChunkType.EMPTY) {
      this.masterTexture.context.clearRect(
        chunk.cx * CHUNK_SIZE, chunk.cy * CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE,
      )
    } else if (chunk.type === ChunkType.PARTIAL) {
      this.renderSolidChunk(chunk, true)
    } else {
      // FULL: skip edge detection for interior chunks with no empty neighbors
      this.renderSolidChunk(chunk, chunk.hasAnyEmptyNeighbors)
    }
    chunk.renderDirty = false
  }

  private renderSolidChunk(chunk: Chunk, withEdgeDetection: boolean): void {
    const pixels = this.chunkPixels
    pixels.fill(0)

    const cx = chunk.cx
    const cy = chunk.cy
    const offX = cx * CHUNK_SIZE
    const offY = cy * CHUNK_SIZE
    const tilemap = this.scene.tilemap

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tx = offX + x
        const ty = offY + y
        const tileType = tilemap.getTile(tx, ty)
        if (tileType === TerrainType.EMPTY) continue

        let color: number
        if (tileType === TerrainType.PERMANENT) {
          color = TERRAIN_TYPE_TRANSITION_COLORS[TerrainType.PERMANENT]
        } else {
          color = this.scene.tileMapChunkPixelRenderer(tx, ty, cx, cy)
        }

        if (withEdgeDetection) {
          const isEdge =
            tilemap.getTile(tx, ty - 1) === TerrainType.EMPTY ||
            tilemap.getTile(tx, ty + 1) === TerrainType.EMPTY ||
            tilemap.getTile(tx - 1, ty) === TerrainType.EMPTY ||
            tilemap.getTile(tx + 1, ty) === TerrainType.EMPTY
          if (isEdge) color = shiftColorValue(color, -60)
        }

        // Phaser color is 0xRRGGBB; Uint32 on little-endian is 0xAABBGGRR
        pixels[y * CHUNK_SIZE + x] =
          0xFF000000 |
          ((color & 0xFF) << 16) |
          (color & 0xFF00) |
          ((color >> 16) & 0xFF)
      }
    }

    this.masterTexture.context.putImageData(this.chunkBuffer, offX, offY)
  }

  private getDebugGraphics(chunk: Chunk): Graphics {
    let debugGraphic = this.chunkDebugGraphics.get(chunk)
    if (!debugGraphic) {
      const wx = chunk.cx * CHUNK_SIZE
      const wy = chunk.cy * CHUNK_SIZE
      const m = 1
      debugGraphic = this.scene.add.graphics()
      debugGraphic.lineStyle(1, 0x00ff00, 0.5)
      debugGraphic.strokeRect(wx + m, wy + m, CHUNK_SIZE - m * 2, CHUNK_SIZE - m * 2)
      this.chunkDebugGraphics.set(chunk, debugGraphic)
      this.debugLayer.add(debugGraphic)
    }
    return debugGraphic
  }

  destroy() {
    super.destroy()

    this.masterTexture?.destroy()

    // @ts-expect-error: destroy
    this.masterTexture = null
    // @ts-expect-error: destroy
    this.masterImage = null
    // @ts-expect-error: destroy
    this.chunkDebugGraphics = null
    // @ts-expect-error: destroy
    this.visibleChunks = null
    // @ts-expect-error: destroy
    this.prevVisibleChunks = null
  }
}
