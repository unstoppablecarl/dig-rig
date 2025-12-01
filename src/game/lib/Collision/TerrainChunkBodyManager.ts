import type { GameLevel } from '../../scenes/GameLevel.ts'
import { CHUNK_SIZE, TILE_SIZE } from '../../config.ts'
import type { Chunk } from '../TileMap/Chunk.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import { MASK_TERRAIN } from './BodyCategories.ts'

const FRICTION = 0.5
const RESTITUTION = 0.1

type Rect = { x: number, y: number, w: number, h: number }

export class TerrainChunkBodyManager extends SceneBound {

  private chunkBodies = new Map<string, MatterJS.BodyType[]>()
  // chunks with collision bodies currently active
  private activeChunks = new Set<string>()

  private updateRadius: number = 100

  // reusable to reduce memory CG pressure
  private visitedChunks = new Set<string>()
  private rectangles: Array<Rect> = []

  constructor(
    public scene: GameLevel,
    updateRadius: number = 100,
  ) {
    super(scene)
    this.scene = scene
    this.updateRadius = updateRadius
  }

  update() {
    const tilemap = this.scene.tilemap
    const dynamicBodies = this.scene.matter.world.getAllBodies()
      .filter((body: MatterJS.BodyType) => !body.isStatic)

    if (dynamicBodies.length === 0) {
      this.clearAllCollision()
      return
    }

    // chunks within updateRadius of a dynamic body
    const chunksNeeded = new Set<string>()

    for (const body of dynamicBodies) {
      const bounds = body.bounds
      const margin = this.updateRadius / TILE_SIZE

      const minCX = Math.floor((bounds.min.x / TILE_SIZE - margin) / CHUNK_SIZE)
      const maxCX = Math.ceil((bounds.max.x / TILE_SIZE + margin) / CHUNK_SIZE)
      const minCY = Math.floor((bounds.min.y / TILE_SIZE - margin) / CHUNK_SIZE)
      const maxCY = Math.ceil((bounds.max.y / TILE_SIZE + margin) / CHUNK_SIZE)

      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cx = minCX; cx <= maxCX; cx++) {
          const chunkKey = `${cx},${cy}`
          chunksNeeded.add(chunkKey)
        }
      }
    }

    // clear collisions from chunks outside updateRadius
    for (const chunkKey of this.activeChunks) {
      if (!chunksNeeded.has(chunkKey)) {
        this.clearChunkBodies(chunkKey)
      }
    }

    // add/update collision bodies for chunks
    for (const chunkKey of chunksNeeded) {
      const chunk = tilemap.chunkManager.getChunkByKey(chunkKey)

      if (!chunk) continue

      if (chunk.isEmpty) {
        if (this.activeChunks.has(chunkKey)) {
          this.clearChunkBodies(chunkKey)
        }
        continue
      }

      // create collision body if chunk is not active yet
      if (!this.activeChunks.has(chunkKey)) {
        this.createChunkBodies(chunkKey, chunk)
        chunk.collisionDirty = false
      }

      // update collision body if chunk is dirty AND it has not been synced yet
      else if (chunk.collisionDirty) {
        this.updateChunkCollision(chunkKey, chunk)
        chunk.collisionDirty = false
      }
    }
  }

  private createChunkBodies(chunkKey: string, chunk: Chunk) {
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
      const worldX = rect.x * TILE_SIZE + (rect.w * TILE_SIZE) / 2
      const worldY = rect.y * TILE_SIZE + (rect.h * TILE_SIZE) / 2
      const width = rect.w * TILE_SIZE
      const height = rect.h * TILE_SIZE

      const body = this.scene.matter.add.rectangle(
        worldX,
        worldY,
        width,
        height,
        {
          isStatic: true,
          friction: FRICTION,
          restitution: RESTITUTION,
          label: `terrain_chunk_${chunkKey}`,
          collisionFilter: {
            category: MASK_TERRAIN,
          },
        },
      )

      bodies.push(body)
    }

    this.chunkBodies.set(chunkKey, bodies)
    this.activeChunks.add(chunkKey)
  }

  private clearChunkBodies(chunkKey: string) {
    const bodies = this.chunkBodies.get(chunkKey)
    if (!bodies) return

    for (const body of bodies) {
      this.scene.matter.world.remove(body)
    }

    this.chunkBodies.delete(chunkKey)
    this.activeChunks.delete(chunkKey)
  }

  private updateChunkCollision(chunkKey: string, chunk: Chunk) {
    this.clearChunkBodies(chunkKey)

    if (!chunk.isEmpty) {
      this.createChunkBodies(chunkKey, chunk)
    }
  }

  // group adjacent solid tiles into rectangles within a chunk's bounds
  private findTileRectanglesInChunk(
    minTX: number,
    minTY: number,
    maxTX: number,
    maxTY: number,
  ) {
    this.visitedChunks.clear()
    const visited = this.visitedChunks
    this.rectangles = []
    const rectangles = this.rectangles
    const tilemap = this.scene.tilemap

    for (let ty = minTY; ty < maxTY; ty++) {
      for (let tx = minTX; tx < maxTX; tx++) {
        const key = `${tx},${ty}`
        if (visited.has(key)) continue
        if (!tilemap.isSolid(tx, ty)) continue

        // find width of horizontal run (stay within chunk bounds)
        let width = 1
        while (
          tx + width < maxTX &&
          tilemap.isSolid(tx + width, ty) &&
          !visited.has(`${tx + width},${ty}`)
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
              visited.has(`${tx + dx},${ty + height}`)
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
            visited.add(`${tx + dx},${ty + dy}`)
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

  destroy() {
    super.destroy()

    // @ts-expect-error: destroy
    this.chunkBodies = null
    // @ts-expect-error: destroy
    this.activeChunks = null
  }
}