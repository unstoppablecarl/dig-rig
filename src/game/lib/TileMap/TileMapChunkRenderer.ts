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
  public renderedCount: number

  private chunkTextures = new Map<Chunk, CanvasTexture>()
  private chunkImages = new Map<Chunk, Image>()
  private chunkDebugGraphics = new Map<Chunk, Graphics>()
  private visibleChunks = new Set<Chunk>()
  private prevVisibleChunks = new Set<Chunk>()

  private layer: Layer
  private debugLayer: Layer

  private changedChunks = new Set<Chunk>()
  private emptyChunks = new Set<Chunk>()

  public constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    this.scene = scene
    this.layer = scene.layers.terrain
    this.debugLayer = scene.layers.terrainDebug
  }

  render() {
    const changedChunks = this.changedChunks
    const emptyChunks = this.emptyChunks

    changedChunks.clear()
    emptyChunks.clear()

    const cam = this.scene.cameras.main
    const view = cam.worldView
    const zoom = cam.zoom
    const margin = 6

    const viewRadiusX = Math.ceil(view.width / 2 / CHUNK_SIZE / zoom) + margin
    const viewRadiusY = Math.ceil(view.height / 2 / CHUNK_SIZE / zoom) + margin

    const cxCenter = Math.floor(cam.midPoint.x / CHUNK_SIZE)
    const cyCenter = Math.floor(cam.midPoint.y / CHUNK_SIZE)

    this.visibleChunks.clear()
    let renderedCount = 0

    const chunkManager = this.scene.tilemap.chunkManager
    const { width, height } = chunkManager

    for (let dy = -viewRadiusY; dy <= viewRadiusY; dy++) {
      for (let dx = -viewRadiusX; dx <= viewRadiusX; dx++) {
        const cx = cxCenter + dx
        const cy = cyCenter + dy
        if (cx < 0 || cy < 0 || cx > width - 1 || cy > height - 1) continue
        const chunk = chunkManager.getChunk(cx, cy)
        if (!chunk) continue

        const img = this.chunkImages.get(chunk)
        if (img && !img.active) {
          img.setActive(true).setVisible(true)
        }

        let isEmpty = chunk.type === ChunkType.EMPTY
        this.visibleChunks.add(chunk)

        if (chunk.renderDirty) {
          isEmpty = this.renderChunkToTexture(chunk)
          if (isEmpty) {
            emptyChunks.add(chunk)
          }
          changedChunks.add(chunk)
        }

        if (DRAW_CHUNKS_DEBUG) {
          this.getDebugGraphics(chunk).setVisible(!isEmpty)
        }

        if (!isEmpty) renderedCount++
      }
    }

    for (const chunk of changedChunks) {
      if (emptyChunks.has(chunk)) {
        chunk.type = ChunkType.EMPTY
        continue
      }

      const isEdge = chunkManager.checkAdjacent(chunk, (other) => {
        if (other === undefined) return false
        // use current frame result
        if (changedChunks.has(other)) return emptyChunks.has(other)
        // use persisted type
        return other.type === ChunkType.EMPTY
      })

      if (isEdge) {
        chunk.type = ChunkType.EDGE
      } else {
        chunk.type = ChunkType.CONTAINED
      }
    }

    for (const chunk of this.prevVisibleChunks) {
      if (!this.visibleChunks.has(chunk)) {
        const g = this.chunkImages.get(chunk)
        if (g?.active) g.setActive(false).setVisible(false)

        if (DRAW_CHUNKS_DEBUG) {
          this.chunkDebugGraphics.get(chunk)!.setVisible(false)
        }
      }
    }

    // swap for next frame
    [this.visibleChunks, this.prevVisibleChunks] = [this.prevVisibleChunks, this.visibleChunks]
    this.visibleChunks.clear()

    this.renderedCount = renderedCount
  }

  private renderChunkToTexture(chunk: Chunk): boolean {
    let texture = this.chunkTextures.get(chunk)
    if (!texture) {
      const key = 'chunk_' + chunk.id
      texture = this.scene.textures.createCanvas(key, CHUNK_SIZE, CHUNK_SIZE)!
      const img = this.scene.add.image(chunk.cx * CHUNK_SIZE, chunk.cy * CHUNK_SIZE, key)
        .setOrigin(0, 0)
      this.layer.add(img)
      this.chunkImages.set(chunk, img)
      this.chunkTextures.set(chunk, texture)
    }

    // Uint32Array view of imageData.data
    const pixels = texture.pixels
    pixels.fill(0)

    const cx = chunk.cx
    const cy = chunk.cy
    const offX = cx * CHUNK_SIZE
    const offY = cy * CHUNK_SIZE

    const tilemap = this.scene.tilemap
    let isEmpty = true

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tx = offX + x
        const ty = offY + y
        const tileType = tilemap.getTile(tx, ty)
        if (tileType === TerrainType.EMPTY) continue

        isEmpty = false
        let color: number
        if (tileType === TerrainType.PERMANENT) {
          color = TERRAIN_TYPE_TRANSITION_COLORS[TerrainType.PERMANENT]
        } else {
          color = this.scene.tileMapChunkPixelRenderer(tx, ty, cx, cy)
        }

        const isEdge =
          tilemap.getTile(tx, ty - 1) === TerrainType.EMPTY ||
          tilemap.getTile(tx, ty + 1) === TerrainType.EMPTY ||
          tilemap.getTile(tx - 1, ty) === TerrainType.EMPTY ||
          tilemap.getTile(tx + 1, ty) === TerrainType.EMPTY

        if (isEdge) color = shiftColorValue(color, -60)

        // Phaser color is 0xRRGGBB; Uint32 on little-endian is 0xAABBGGRR
        pixels[y * CHUNK_SIZE + x] =
          0xFF000000 |
          ((color & 0xFF) << 16) |
          (color & 0xFF00) |
          ((color >> 16) & 0xFF)
      }
    }

    texture.putData(texture.imageData, 0, 0)
    texture.refresh()
    // refresh() resets filter to LINEAR (antialias config), re-apply after every upload
    texture.source[0].setFilter(NEAREST)

    chunk.renderDirty = false

    return isEmpty
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

    if (this.chunkTextures) {
      for (const texture of this.chunkTextures.values()) {
        texture.destroy()
      }
    }

    // @ts-expect-error: destroy
    this.chunkTextures = null
    // @ts-expect-error: destroy
    this.chunkImages = null
    // @ts-expect-error: destroy
    this.chunkDebugGraphics = null
    // @ts-expect-error: destroy
    this.visibleChunks = null
    // @ts-expect-error: destroy
    this.prevVisibleChunks = null
  }
}