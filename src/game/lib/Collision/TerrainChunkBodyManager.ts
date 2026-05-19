import { CHUNK_SIZE } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { type Chunk, ChunkType } from '../Tilemap/Chunk.ts'
import type { ChunkManager } from '../Tilemap/ChunkManager.ts'
import { MASK_TERRAIN } from './BodyCategories.ts'

const FRICTION = 0.5
const RESTITUTION = 0.1

type Rect = { x: number, y: number, w: number, h: number }

export class TerrainChunkBodyManager extends SceneBound {

  private chunkBodies = new Map<Chunk, MatterJS.BodyType[]>()
  // chunks with collision bodies currently active
  private activeChunks = new Set<Chunk>()

  private updateRadius: number = 100

  private visitedTiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE)
  private rectangles: Array<Rect> = []
  private chunkManager: ChunkManager
  private chunksNeeded = new Set<Chunk>()

  constructor(
    public scene: GameLevel,
    updateRadius: number = 100,
  ) {
    super(scene)
    this.chunkManager = scene.tilemap.chunkManager
    this.updateRadius = updateRadius
  }

  update() {
    const dynamicBodies = this.scene.matter.world.getAllBodies()
      .filter((body: MatterJS.BodyType) => !body.isStatic)

    if (dynamicBodies.length === 0) {
      this.clearAllCollision()
      return
    }

    // chunks within updateRadius of a dynamic body
    const chunksNeeded = this.chunksNeeded
    chunksNeeded.clear()

    for (const body of dynamicBodies) {
      const bounds = body.bounds
      const margin = this.updateRadius

      const minCX = Math.floor((bounds.min.x - margin) / CHUNK_SIZE)
      const maxCX = Math.ceil((bounds.max.x + margin) / CHUNK_SIZE)
      const minCY = Math.floor((bounds.min.y - margin) / CHUNK_SIZE)
      const maxCY = Math.ceil((bounds.max.y + margin) / CHUNK_SIZE)

      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cx = minCX; cx <= maxCX; cx++) {
          const c = this.chunkManager.getChunk(cx, cy)
          if (c) {
            chunksNeeded.add(c)
          }
        }
      }
    }

    // clear collisions from chunks outside updateRadius
    for (const chunk of this.activeChunks) {
      if (!chunksNeeded.has(chunk)) {
        this.clearChunkBodies(chunk)
      }
    }

    // add/update collision bodies for chunks
    for (const chunk of chunksNeeded) {

      if (chunk.type === ChunkType.EMPTY) {
        if (this.activeChunks.has(chunk)) {
          this.clearChunkBodies(chunk)
        }
        continue
      }

      // create collision body if chunk is not active yet
      if (!this.activeChunks.has(chunk)) {
        this.createChunkBodies(chunk)
        chunk.collisionDirty = false
      }

      // update collision body if chunk is dirty AND it has not been synced yet
      else if (chunk.collisionDirty) {
        this.updateChunkCollision(chunk)
        chunk.collisionDirty = false
      }
    }
  }

  private createChunkBodies(chunk: Chunk) {
    const startTX = chunk.cx * CHUNK_SIZE
    const startTY = chunk.cy * CHUNK_SIZE
    const endTX = Math.min(startTX + CHUNK_SIZE, this.scene.tilemap.width)
    const endTY = Math.min(startTY + CHUNK_SIZE, this.scene.tilemap.height)

    const rectangles = this.findTileRectanglesInChunk(startTX, startTY, endTX, endTY)

    // empty chunks should have already been skipped but double check
    if (rectangles.length === 0) {
      return
    }

    const bodies: MatterJS.BodyType[] = []

    for (const rect of rectangles) {
      const worldX = rect.x + (rect.w) / 2
      const worldY = rect.y + (rect.h) / 2
      const width = rect.w
      const height = rect.h

      const body = this.scene.matter.add.rectangle(
        worldX,
        worldY,
        width,
        height,
        {
          isStatic: true,
          friction: FRICTION,
          restitution: RESTITUTION,
          label: `terrain_chunk_${chunk.id}`,
          collisionFilter: {
            category: MASK_TERRAIN,
          },
        },
      )

      bodies.push(body)
    }

    this.chunkBodies.set(chunk, bodies)
    this.activeChunks.add(chunk)
  }

  private clearChunkBodies(chunk: Chunk) {
    const bodies = this.chunkBodies.get(chunk)
    if (!bodies) return

    for (const body of bodies) {
      this.scene.matter?.world?.remove(body)
    }

    this.chunkBodies.delete(chunk)
    this.activeChunks.delete(chunk)
  }

  private updateChunkCollision(chunk: Chunk) {
    this.clearChunkBodies(chunk)

    if (chunk.type !== ChunkType.EMPTY) {
      this.createChunkBodies(chunk)
    }
  }

  // group adjacent solid tiles into rectangles within a chunk's bounds
  private findTileRectanglesInChunk(
    minTX: number,
    minTY: number,
    maxTX: number,
    maxTY: number,
  ) {
    const visited = this.visitedTiles
    visited.fill(0)
    this.rectangles.length = 0
    const rectangles = this.rectangles
    const tilemap = this.scene.tilemap
    const idx = (tx: number, ty: number) => (ty - minTY) * CHUNK_SIZE + (tx - minTX)

    for (let ty = minTY; ty < maxTY; ty++) {
      for (let tx = minTX; tx < maxTX; tx++) {
        if (visited[idx(tx, ty)]) continue
        if (!tilemap.isSolid(tx, ty)) continue

        // find width of horizontal run (stay within chunk bounds)
        let width = 1
        while (
          tx + width < maxTX &&
          tilemap.isSolid(tx + width, ty) &&
          !visited[idx(tx + width, ty)]
          ) {
          width++
        }

        // find height of rectangle (stay within chunk bounds)
        let height = 1
        let canExpand = true
        while (canExpand && ty + height < maxTY) {
          for (let dx = 0; dx < width; dx++) {
            if (
              !tilemap.isSolid(tx + dx, ty + height) ||
              visited[idx(tx + dx, ty + height)]
            ) {
              canExpand = false
              break
            }
          }
          if (canExpand) height++
        }

        // mark tiles as visited
        for (let dy = 0; dy < height; dy++) {
          for (let dx = 0; dx < width; dx++) {
            visited[idx(tx + dx, ty + dy)] = 1
          }
        }

        rectangles.push({ x: tx, y: ty, w: width, h: height })
      }
    }

    return rectangles
  }

  private clearAllCollision() {
    for (const chunkKey of this.activeChunks) {
      this.clearChunkBodies(chunkKey)
    }
  }

  protected onDestroy() {
    this.clearAllCollision()
    // @ts-expect-error: destroy
    this.chunkBodies = null
    // @ts-expect-error: destroy
    this.activeChunks = null
    // @ts-expect-error: destroy
    this.visitedTiles = null
    // @ts-expect-error: destroy
    this.rectangles = null
    // @ts-expect-error: destroy
    this.chunkManager = null
    // @ts-expect-error: destroy
    this.chunksNeeded = null
  }
}