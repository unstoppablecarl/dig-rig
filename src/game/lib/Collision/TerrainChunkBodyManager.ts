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

  // One compound body per active chunk (all rects merged into a single Matter body).
  private chunkBodies = new Map<Chunk, MatterJS.BodyType>()
  private activeChunks = new Set<Chunk>()

  // Dynamic bodies to track — register with track() after construction.
  private trackedBodies: MatterJS.BodyType[] = []

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

  trackAllDynamic() {
    for (const body of this.scene.matter.world.getAllBodies()) {
      if (!body.isStatic) this.track(body)
    }
  }

  track(body: MatterJS.BodyType) {
    if (!this.trackedBodies.includes(body)) {
      this.trackedBodies.push(body)
    }
  }

  untrack(body: MatterJS.BodyType) {
    const idx = this.trackedBodies.indexOf(body)
    if (idx !== -1) {
      this.trackedBodies.splice(idx, 1)
    }
  }

  update() {
    const dynamicBodies = this.trackedBodies

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

    // Fast path: fully solid chunk → single rectangle, skip the sweep
    let rectangles: Rect[]
    if (chunk.type === ChunkType.FULL) {
      rectangles = [{
        x: startTX,
        y: startTY,
        w: endTX - startTX,
        h: endTY - startTY
      }]
    } else {
      rectangles = this.findTileRectanglesInChunk(startTX, startTY, endTX, endTY)
    }

    if (rectangles.length === 0) return

    const collisionFilter = { category: MASK_TERRAIN }

    // Create one part-body per merged rectangle (not added to the world individually)
    const parts = rectangles.map(r =>
      this.scene.matter.bodies.rectangle(
        r.x + r.w / 2,
        r.y + r.h / 2,
        r.w,
        r.h,
      ) as unknown as MatterJS.Body,
    )

    // Merge all parts into a single compound body — one entry in Matter's broad phase
    const compound = this.scene.matter.body.create({
      parts,
      isStatic: true,
      friction: FRICTION,
      restitution: RESTITUTION,
      label: `terrain_chunk_${chunk.id}`,
    })

    // Propagate collision filter to every part (including the parent compound at index 0)
    for (const part of compound.parts) {
      part.collisionFilter = collisionFilter
    }

    this.scene.matter.world.add(compound)
    this.chunkBodies.set(chunk, compound)
    this.activeChunks.add(chunk)
  }

  private clearChunkBodies(chunk: Chunk) {
    const body = this.chunkBodies.get(chunk)
    if (!body) return
    this.scene.matter?.world?.remove(body)
    this.chunkBodies.delete(chunk)
    this.activeChunks.delete(chunk)
  }

  private updateChunkCollision(chunk: Chunk) {
    // Save the old compound before touching the maps
    const old = this.chunkBodies.get(chunk)

    // Clear tracking so createChunkBodies can register the new body cleanly
    this.chunkBodies.delete(chunk)
    this.activeChunks.delete(chunk)

    if (chunk.type !== ChunkType.EMPTY) {
      // new body added to world first — no gap frame
      this.createChunkBodies(chunk)
    }

    // Remove old body after new one is live
    if (old) {
      this.scene.matter?.world?.remove(old)
    }
  }

  // Groups adjacent solid tiles into merged rectangles using a greedy row-sweep.
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

        let width = 1
        while (
          tx + width < maxTX &&
          tilemap.isSolid(tx + width, ty) &&
          !visited[idx(tx + width, ty)]
          ) width++

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

        for (let dy = 0; dy < height; dy++)
          for (let dx = 0; dx < width; dx++)
            visited[idx(tx + dx, ty + dy)] = 1

        rectangles.push({ x: tx, y: ty, w: width, h: height })
      }
    }

    return rectangles
  }

  private clearAllCollision() {
    for (const chunk of this.activeChunks) {
      this.clearChunkBodies(chunk)
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
    // @ts-expect-error: destroy
    this.trackedBodies = null
  }
}
