import { GameObjects } from 'phaser'
import { CHUNK_SIZE, DRAW_CHUNKS_DEBUG, TERRAIN_TYPE_TRANSITION_COLORS, TILE_SIZE } from '../../config.ts'
import { shiftColorValue } from '../../helpers/colors.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Chunk } from './Chunk.ts'
import { getChunkKey } from './ChunkManager.ts'
import { TerrainType } from './TileMap.ts'
import Graphics = GameObjects.Graphics
import Layer = GameObjects.Layer

export class TileMapChunkRenderer extends SceneBound {
  public renderedCount: number

  private chunkGraphics = new Map<string, Graphics>()
  private chunkDebugGraphics = new Map<string, Graphics>()
  private visibleChunks = new Set<string>()

  private layer: Layer
  private debugLayer: Layer

  public constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    this.scene = scene
    this.layer = scene.layers.terrain
    this.debugLayer = scene.layers.terrainDebug
  }

  render() {
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
        const key = getChunkKey(cx, cy)

        const chunk = chunkManager.getChunkByKey(key)!
        const graphics = this.getChunkGraphics(key)

        this.visibleChunks.add(key)
        if (chunk.renderDirty) {
          this.renderChunkToGraphics(graphics, chunk)
        }

        if (!graphics.active) {
          graphics.setActive(true).setVisible(true)
        }

        if (DRAW_CHUNKS_DEBUG) {
          this.getDebugGraphics(key, cx, cy).setVisible(!chunk.isEmpty)
        }

        if (!chunk.isEmpty) renderedCount++
      }
    }

    // Hide graphics outside view
    for (const [key, graphics] of this.chunkGraphics) {
      let visible = this.visibleChunks.has(key)
      if (!visible && graphics.active) {
        graphics.setActive(false).setVisible(false)

        if (DRAW_CHUNKS_DEBUG) {
          this.chunkDebugGraphics.get(key)!.setVisible(false)
        }
      }
    }

    this.renderedCount = renderedCount
  }

  private renderChunkToGraphics(graphics: Graphics, chunk: Chunk) {
    graphics.clear()

    const startX = chunk.cx * CHUNK_SIZE
    const startY = chunk.cy * CHUNK_SIZE
    let isEmpty = true

    for (let y = startY; y < startY + CHUNK_SIZE; y++) {
      for (let x = startX; x < startX + CHUNK_SIZE; x++) {
        let tilemap = this.scene.tilemap
        const tileType = tilemap.getTile(x, y)
        if (tileType === TerrainType.EMPTY) continue

        isEmpty = false

        let color: number
        if (tileType === TerrainType.PERMANENT) {
          color = TERRAIN_TYPE_TRANSITION_COLORS[TerrainType.PERMANENT]
        } else {
          color = this.scene.patternStore.IMG_PATTERN(x, y)
        }

        const isEdge =
          tilemap.getTile(x, y - 1) === TerrainType.EMPTY ||
          tilemap.getTile(x, y + 1) === TerrainType.EMPTY ||
          tilemap.getTile(x - 1, y) === TerrainType.EMPTY ||
          tilemap.getTile(x + 1, y) === TerrainType.EMPTY

        if (isEdge) {
          color = shiftColorValue(color, -60)
        }

        graphics.fillStyle(color, 1)
        graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
      }
    }

    chunk.isEmpty = isEmpty
    chunk.renderDirty = false
  }

  private getChunkGraphics(key: string): Graphics {
    let graphics = this.chunkGraphics.get(key)
    if (!graphics) {
      graphics = this.scene.add.graphics()
      this.layer.add(graphics)
      this.chunkGraphics.set(key, graphics)
    }
    return graphics
  }

  private getDebugGraphics(key: string, cx: number, cy: number): Graphics {
    let debugGraphic = this.chunkDebugGraphics.get(key)
    if (!debugGraphic) {
      const wx = cx * CHUNK_SIZE
      const wy = cy * CHUNK_SIZE
      const m = 1
      debugGraphic = this.scene.add.graphics()
      debugGraphic.lineStyle(1, 0x00ff00, 0.5)
      debugGraphic.strokeRect(wx + m, wy + m, CHUNK_SIZE - m * 2, CHUNK_SIZE - m * 2)
      this.chunkDebugGraphics.set(key, debugGraphic)
      this.debugLayer.add(debugGraphic)
    }
    return debugGraphic
  }

  destroy() {
    super.destroy()

    // @ts-expect-error: destroy
    this.chunkGraphics = null
    // @ts-expect-error: destroy
    this.chunkDebugGraphics = null
    // @ts-expect-error: destroy
    this.visibleChunks = null
  }
}