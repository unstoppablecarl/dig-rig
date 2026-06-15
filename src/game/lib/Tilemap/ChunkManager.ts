import { CHUNK_SIZE } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { isAnchored, matterType, MatterType, PERMANENT } from '../Matter/_Matter.types.ts'

import { ALWAYS_STRUCTURAL } from '../Matter/matter.ts'
import { Chunk, type ChunkId } from './Chunk.ts'

// Chunk anchoring only tracks always-structural types (SOLID, WAX) and ANCHORED tiles —
// not STRUCTURAL_FLAG tiles. Including STRUCTURAL_FLAG would let a GUNPOWDER bridge mark
// a chunk as anchored, breaking the invariant that every tile in an anchored chunk is
// reachable from PERMANENT via always-structural paths.
function isChunkStructural(raw: number): boolean {
  const t = matterType(raw)
  return t === PERMANENT || ALWAYS_STRUCTURAL.has(t) || isAnchored(raw)
}

export class ChunkManager extends SceneBound {
  private chunks = new Map<ChunkId, Chunk>()
  public readonly width: number
  public readonly height: number

  private permanentChunkIds = new Set<ChunkId>()
  private anchoringInitialized = false
  private _anchoredDirty = true

  constructor(
    public scene: GameLevel,
    tilemapWidth: number,
    tilemapHeight: number,
  ) {
    super(scene)

    this.width = Math.ceil(tilemapWidth / CHUNK_SIZE)
    this.height = Math.ceil(tilemapHeight / CHUNK_SIZE)

    for (let cy = 0; cy < this.height; cy++) {
      for (let cx = 0; cx < this.width; cx++) {
        const id = (cy * this.width + cx) as ChunkId
        const chunk = new Chunk(id, cx, cy)
        this.chunks.set(id, chunk)
      }
    }
  }

  getChunk(cx: number, cy: number): Chunk | undefined {
    return this.chunks.get((cy * this.width + cx) as ChunkId)
  }

  getChunkById(id: ChunkId): Chunk | undefined {
    return this.chunks.get(id)
  }

  getChunkByTile(tx: number, ty: number): Chunk | undefined {
    const cx = Math.floor(tx / CHUNK_SIZE)
    const cy = Math.floor(ty / CHUNK_SIZE)
    return this.getChunk(cx, cy)
  }

  setDirty(tx: number, ty: number, oldType: number, newType: number) {
    const chunk = this.getChunkByTile(tx, ty)
    if (!chunk) return

    const wasSolid = matterType(oldType) !== MatterType.EMPTY
    const isSolid = matterType(newType) !== MatterType.EMPTY
    if (isSolid && !wasSolid) chunk.solidTileCount++
    if (wasSolid && !isSolid) chunk.solidTileCount--

    // Invalidate chunk anchoring when always-structural or anchored tiles change.
    const wasStructural = ALWAYS_STRUCTURAL.has(matterType(oldType)) || isAnchored(oldType)
    const isNowStructural = ALWAYS_STRUCTURAL.has(matterType(newType)) || isAnchored(newType)
    if (wasStructural !== isNowStructural) this._anchoredDirty = true

    const { cx, cy } = chunk

    chunk.setDirty()

    // mark adjacent chunks dirty — glow/outline may cross chunk boundaries
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue
        const neighbor = this.getChunk(cx + dx, cy + dy)
        if (neighbor) neighbor.renderDirty = true
      }
    }
  }

  // BFS at chunk level from permanent/boundary sources.
  // After this call every chunk.anchored flag is correct: true means an always-structural
  // tile-level path exists from that chunk to permanent terrain or the world edge.
  // Skipped when no always-structural or anchored tiles changed since the last run.
  computeAnchored(): void {
    if (!this.anchoringInitialized) {
      this.initPermanentChunks()
      this.anchoringInitialized = true
    }
    if (!this._anchoredDirty) return
    this._anchoredDirty = false

    for (const chunk of this.chunks.values()) chunk.anchored = false

    const queue: Chunk[] = []
    for (const id of this.permanentChunkIds) {
      const chunk = this.chunks.get(id)
      if (!chunk) continue
      chunk.anchored = true
      queue.push(chunk)
    }

    let head = 0
    while (head < queue.length) {
      const chunk = queue[head++]
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const neighbor = this.getChunk(chunk.cx + dx, chunk.cy + dy)
        if (!neighbor || neighbor.anchored) continue
        if (this.hasSolidBorder(chunk, dx, dy)) {
          neighbor.anchored = true
          queue.push(neighbor)
        }
      }
    }
  }

  // Scan once at level load to find which chunks are permanent sources.
  // Boundary chunks are always sources (adjacent to out-of-bounds = PERMANENT).
  // Interior chunks are sources only if they contain a PERMANENT tile.
  private initPermanentChunks(): void {
    const { tilemap } = this.scene

    for (let cy = 0; cy < this.height; cy++) {
      for (let cx = 0; cx < this.width; cx++) {
        if (cx === 0 || cx === this.width - 1 || cy === 0 || cy === this.height - 1) {
          this.permanentChunkIds.add((cy * this.width + cx) as ChunkId)
          continue
        }
        const x0 = cx * CHUNK_SIZE, y0 = cy * CHUNK_SIZE
        const x1 = Math.min(x0 + CHUNK_SIZE, tilemap.width)
        const y1 = Math.min(y0 + CHUNK_SIZE, tilemap.height)
        scan: for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            if (tilemap.getTile(x, y) === PERMANENT) {
              this.permanentChunkIds.add((cy * this.width + cx) as ChunkId)
              break scan
            }
          }
        }
      }
    }
  }

  // Returns true if there is at least one pair of adjacent SOLID tiles straddling
  // the shared border between `chunk` and its neighbour in direction (dx, dy).
  private hasSolidBorder(chunk: Chunk, dx: number, dy: number): boolean {
    const { tilemap } = this.scene
    const x0 = chunk.cx * CHUNK_SIZE
    const y0 = chunk.cy * CHUNK_SIZE
    const xEnd = Math.min(x0 + CHUNK_SIZE, tilemap.width)
    const yEnd = Math.min(y0 + CHUNK_SIZE, tilemap.height)

    if (dx === 1) {
      const ax = xEnd - 1, bx = xEnd
      for (let y = y0; y < yEnd; y++) {
        if (isChunkStructural(tilemap.getTile(ax, y)) && isChunkStructural(tilemap.getTile(bx, y))) return true
      }
    } else if (dx === -1) {
      const ax = x0, bx = x0 - 1
      for (let y = y0; y < yEnd; y++) {
        if (isChunkStructural(tilemap.getTile(ax, y)) && isChunkStructural(tilemap.getTile(bx, y))) return true
      }
    } else if (dy === 1) {
      const ay = yEnd - 1, by = yEnd
      for (let x = x0; x < xEnd; x++) {
        if (isChunkStructural(tilemap.getTile(x, ay)) && isChunkStructural(tilemap.getTile(x, by))) return true
      }
    } else {
      const ay = y0, by = y0 - 1
      for (let x = x0; x < xEnd; x++) {
        if (isChunkStructural(tilemap.getTile(x, ay)) && isChunkStructural(tilemap.getTile(x, by))) return true
      }
    }
    return false
  }

  protected onDestroy() {
    // @ts-expect-error: destroy
    this.chunks = null
  }
}
