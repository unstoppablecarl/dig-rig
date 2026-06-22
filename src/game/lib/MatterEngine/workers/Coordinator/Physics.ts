/// <reference lib="webworker" />
import { CHUNK_SIZE } from '../../../../config.ts'
import { getSupport, isSettled, matterType, PERMANENT, SOLID, SupportType } from '../../../Matter/_Matter.types.ts'
import { COLLIDES_WHEN_SETTLED, getSupportType, setSupport, STRUCTURAL_COLLAPSE_TO } from '../../../Matter/matter.ts'
import { ChunkGrid } from '../../../Tilemap/ChunkGrid.ts'
import { MatterSim } from '../MatterSim/MatterSim.ts'

type XY = { x: number; y: number }

const BFS_DX = [-1, 1, 0, 0]
const BFS_DY = [0, 0, -1, 1]

function isTileCollidable(raw: number): boolean {
  const type = matterType(raw)
  if (type === SOLID || type === PERMANENT) return true
  if (isSettled(raw)) return COLLIDES_WHEN_SETTLED.has(type)
  return false
}

function isChunkStructural(raw: number): boolean {
  return getSupportType(raw) >= SupportType.STRUCTURAL
}

export class Physics {
  private readonly permanentChunkIds = new Set<number>()
  private _bfsVisited!: Uint32Array  // epoch-tagged; avoids fill(0) between calls
  private _bfsQueue!: Int32Array
  private _bfsComp!: Int32Array
  private _anchoredQueue!: Int32Array
  private _bfsEpoch = 0

  constructor(
    private readonly sim: MatterSim,
    private readonly chunkGrid: ChunkGrid,
    private readonly width: number,
    private readonly height: number,
    private readonly chunksWide: number,
    private readonly chunksHigh: number,
  ) {
    const n = this.width * this.height
    this._bfsVisited = new Uint32Array(n)
    this._bfsQueue = new Int32Array(n)
    this._bfsComp = new Int32Array(n)
    this._anchoredQueue = new Int32Array(this.chunksWide * this.chunksHigh)
    this.initPermanentChunks()
    this.initChunkState()
  }

  postStep(dirtyChunks: Set<number>, structuralDirty: boolean): void {
    const { chunksWide, chunksHigh, chunkGrid } = this
    for (const chunkIdx of dirtyChunks) {
      const cx = chunkIdx % chunksWide
      const cy = chunkIdx / chunksWide | 0
      chunkGrid.setSolidCount(chunkIdx, this.countSolidInChunk(cx, cy))
      chunkGrid.markDirty(chunkIdx)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = cx + dx, ny = cy + dy
          if (nx < 0 || nx >= chunksWide || ny < 0 || ny >= chunksHigh) continue
          chunkGrid.markRenderDirty(ny * chunksWide + nx)
        }
      }
    }
    if (structuralDirty) this.computeAnchored()
  }

  chunkIdxForTile(tileIdx: number): number {
    const tx = tileIdx % this.width
    const ty = tileIdx / this.width | 0
    return (ty / CHUNK_SIZE | 0) * this.chunksWide + (tx / CHUNK_SIZE | 0)
  }

  // Returns the subset of newTiles that form a floating island not connected to anchored terrain.
  findIslandTiles(newTiles: XY[]): XY[] {
    if (newTiles.length === 0) return []
    const { width, height, chunkGrid } = this
    const tiles = this.sim.tiles

    if (this._bfsEpoch > 0xFFFFFFFD) {
      this._bfsVisited.fill(0)
      this._bfsEpoch = 0
    }
    this._bfsEpoch += 2
    const VISITED = this._bfsEpoch
    const { _bfsVisited: vis, _bfsQueue: queue } = this

    // Pre-mark new tiles so neighbor checks and BFS can use vis[idx] === VISITED
    let tail = 0
    for (const { x, y } of newTiles) {
      const idx = y * width + x
      vis[idx] = VISITED
      queue[tail++] = idx
    }

    let touchesAnchoredSolid = false
    let touchesUnanchoredSolid = false
    for (const { x, y } of newTiles) {
      for (let d = 0; d < 4; d++) {
        const nx = x + BFS_DX[d], ny = y + BFS_DY[d]
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) return []
        const nidx = ny * width + nx
        if (vis[nidx] === VISITED) continue
        const st = getSupportType(tiles[nidx])
        if (st === SupportType.ANCHORED) return []
        if (st < SupportType.STRUCTURAL) continue
        if (chunkGrid.isAnchoredCoord(nx / CHUNK_SIZE | 0, ny / CHUNK_SIZE | 0)) {
          touchesAnchoredSolid = true
        } else {
          touchesUnanchoredSolid = true
        }
      }
      if (touchesAnchoredSolid) break
    }

    if (touchesAnchoredSolid) return []
    if (!touchesUnanchoredSolid) return newTiles

    let head = 0, anchored = false
    outer: while (head < tail) {
      const idx = queue[head++]
      const x = idx % width
      const y = idx / width | 0
      for (let d = 0; d < 4; d++) {
        const nx = x + BFS_DX[d], ny = y + BFS_DY[d]
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
          anchored = true
          break outer
        }
        const nidx = ny * width + nx
        if (vis[nidx] === VISITED) continue
        const st = getSupportType(tiles[nidx])
        if (st === SupportType.ANCHORED) {
          anchored = true
          break outer
        }
        if (st >= SupportType.STRUCTURAL) {
          if (chunkGrid.isAnchoredCoord(nx / CHUNK_SIZE | 0, ny / CHUNK_SIZE | 0)) {
            anchored = true
            break outer
          }
          vis[nidx] = VISITED
          queue[tail++] = nidx
        }
      }
    }

    return anchored ? [] : newTiles
  }

  // Returns structural tiles adjacent to destroyedTiles that are no longer connected to anchored terrain.
  // dirtyChunks: chunks modified this step — their chunkGrid.anchored data is stale, so we skip the
  // chunk-level pruning for them and rely on tile-level BFS instead.
  findNewlyDisconnected(destroyedTiles: XY[], dirtyChunks: Set<number>): XY[] {
    if (this._bfsEpoch > 0xFFFFFFFD) {
      this._bfsVisited.fill(0)
      this._bfsEpoch = 0
    }
    this._bfsEpoch += 2
    const VISITED = this._bfsEpoch
    const CONFIRMED = this._bfsEpoch + 1
    const { width, height, chunksWide, chunkGrid, _bfsVisited: vis, _bfsQueue: queue, _bfsComp: comp } = this
    const tiles = this.sim.tiles

    const islandTiles: XY[] = []

    for (const { x: dx, y: dy } of destroyedTiles) {
      for (let d = 0; d < 4; d++) {
        const sx = dx + BFS_DX[d], sy = dy + BFS_DY[d]
        if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue
        const sidx = sy * width + sx
        if (vis[sidx] >= VISITED) continue
        const supportType = getSupportType(tiles[sidx])
        if (supportType < SupportType.STRUCTURAL) continue
        if (supportType === SupportType.ANCHORED) {
          vis[sidx] = CONFIRMED
          continue
        }

        // Seed-level pruning: skip full BFS if this tile's chunk is already anchored.
        // Skip the chunk check for dirty chunks — their anchored flag is from the previous step.
        const seedCx = sx / CHUNK_SIZE | 0, seedCy = sy / CHUNK_SIZE | 0
        let seedAnchored = sx === 0 || sx === width - 1 || sy === 0 || sy === height - 1
        if (!seedAnchored && !dirtyChunks.has(seedCy * chunksWide + seedCx)) {
          seedAnchored = chunkGrid.isAnchoredCoord(seedCx, seedCy)
        }
        if (!seedAnchored) {
          for (let dp = 0; dp < 4; dp++) {
            const px = sx + BFS_DX[dp], py = sy + BFS_DY[dp]
            if (px < 0 || px >= width || py < 0 || py >= height) {
              seedAnchored = true
              break
            }
            if (getSupportType(tiles[py * width + px]) === SupportType.ANCHORED) {
              seedAnchored = true
              break
            }
          }
        }
        if (seedAnchored) {
          vis[sidx] = CONFIRMED
          continue
        }

        let head = 0, tail = 0, compLen = 0, anchored = false
        vis[sidx] = VISITED
        queue[tail++] = sidx
        comp[compLen++] = sidx

        bfs: while (head < tail) {
          const cidx = queue[head++]
          const cx = cidx % width
          const cy = (cidx / width) | 0
          for (let d2 = 0; d2 < 4; d2++) {
            const nx = cx + BFS_DX[d2], ny = cy + BFS_DY[d2]
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
              anchored = true
              break bfs
            }
            const nidx = ny * width + nx
            if (vis[nidx] >= VISITED) continue
            const st = getSupportType(tiles[nidx])
            if (st === SupportType.ANCHORED) {
              anchored = true
              break bfs
            }
            if (st >= SupportType.STRUCTURAL) {
              const nCx = nx / CHUNK_SIZE | 0, nCy = ny / CHUNK_SIZE | 0
              if (!dirtyChunks.has(nCy * chunksWide + nCx) && chunkGrid.isAnchoredCoord(nCx, nCy)) {
                anchored = true
                break bfs
              }
              vis[nidx] = VISITED
              queue[tail++] = nidx
              comp[compLen++] = nidx
            }
          }
        }

        for (let k = 0; k < compLen; k++) vis[comp[k]] = CONFIRMED
        if (!anchored) {
          for (let k = 0; k < compLen; k++) {
            const idx = comp[k]
            islandTiles.push({ x: idx % width, y: (idx / width) | 0 })
          }
        }
      }
    }

    return islandTiles
  }

  // Converts floating structural tiles to their collapse types and activates them.
  collapseIslands(islands: XY[], activeSet: Set<number>, dirtyChunks: Set<number>): void {
    const tiles = this.sim.tiles
    const { width } = this

    for (const { x, y } of islands) {
      const idx = y * width + x
      const raw = tiles[idx]
      const t = matterType(raw)
      const collapseType = STRUCTURAL_COLLAPSE_TO[t]
      if (collapseType !== undefined) {
        tiles[idx] = collapseType
      } else if (getSupport(raw) === SupportType.STRUCTURAL) {
        tiles[idx] = setSupport(raw, SupportType.NONE)
        this.sim.markDirty(x, y)
        dirtyChunks.add(this.chunkIdxForTile(idx))
        this.sim.activate(idx, activeSet)
      }
    }
  }

  private initPermanentChunks(): void {
    const { width, height, chunksWide, chunksHigh } = this
    const tiles = this.sim.tiles
    for (let cy = 0; cy < chunksHigh; cy++) {
      for (let cx = 0; cx < chunksWide; cx++) {
        const id = cy * chunksWide + cx
        if (cx === 0 || cx === chunksWide - 1 || cy === 0 || cy === chunksHigh - 1) {
          this.permanentChunkIds.add(id)
          continue
        }
        const x0 = cx * CHUNK_SIZE, y0 = cy * CHUNK_SIZE
        const x1 = Math.min(x0 + CHUNK_SIZE, width)
        const y1 = Math.min(y0 + CHUNK_SIZE, height)
        outer: for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            if (matterType(tiles[y * width + x]) === PERMANENT) {
              this.permanentChunkIds.add(id)
              break outer
            }
          }
        }
      }
    }
  }

  private initChunkState(): void {
    const { chunksWide, chunksHigh, chunkGrid } = this
    for (let cy = 0; cy < chunksHigh; cy++) {
      for (let cx = 0; cx < chunksWide; cx++) {
        const idx = cy * chunksWide + cx
        chunkGrid.setSolidCount(idx, this.countSolidInChunk(cx, cy))
      }
    }
    this.computeAnchored()
  }

  private countSolidInChunk(cx: number, cy: number): number {
    const { width, height } = this
    const tiles = this.sim.tiles
    const x0 = cx * CHUNK_SIZE, y0 = cy * CHUNK_SIZE
    const x1 = Math.min(x0 + CHUNK_SIZE, width)
    const y1 = Math.min(y0 + CHUNK_SIZE, height)
    let count = 0
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (isTileCollidable(tiles[y * width + x])) count++
      }
    }
    return count
  }

  private computeAnchored(): void {
    const { chunksWide, chunksHigh, chunkGrid, _anchoredQueue: queue } = this

    const numChunks = chunksWide * chunksHigh
    for (let i = 0; i < numChunks; i++) chunkGrid.setAnchored(i, false)

    let head = 0, tail = 0
    for (const id of this.permanentChunkIds) {
      chunkGrid.setAnchored(id, true)
      queue[tail++] = id
    }

    while (head < tail) {
      const id = queue[head++]
      const cx = id % chunksWide
      const cy = id / chunksWide | 0
      for (let d = 0; d < 4; d++) {
        const nx = cx + BFS_DX[d], ny = cy + BFS_DY[d]
        if (nx < 0 || nx >= chunksWide || ny < 0 || ny >= chunksHigh) continue
        const nid = ny * chunksWide + nx
        if (chunkGrid.isAnchored(nid)) continue
        if (this.hasSolidBorder(cx, cy, BFS_DX[d], BFS_DY[d])) {
          chunkGrid.setAnchored(nid, true)
          queue[tail++] = nid
        }
      }
    }
  }

  private hasSolidBorder(cx: number, cy: number, dx: number, dy: number): boolean {
    const { width, height } = this
    const tiles = this.sim.tiles
    const x0 = cx * CHUNK_SIZE, y0 = cy * CHUNK_SIZE
    const xEnd = Math.min(x0 + CHUNK_SIZE, width)
    const yEnd = Math.min(y0 + CHUNK_SIZE, height)

    if (dx === 1) {
      for (let y = y0; y < yEnd; y++) {
        if (isChunkStructural(tiles[y * width + xEnd - 1]) && isChunkStructural(tiles[y * width + xEnd])) return true
      }
    } else if (dx === -1) {
      for (let y = y0; y < yEnd; y++) {
        if (isChunkStructural(tiles[y * width + x0]) && isChunkStructural(tiles[y * width + x0 - 1])) return true
      }
    } else if (dy === 1) {
      for (let x = x0; x < xEnd; x++) {
        if (isChunkStructural(tiles[(yEnd - 1) * width + x]) && isChunkStructural(tiles[yEnd * width + x])) return true
      }
    } else {
      for (let x = x0; x < xEnd; x++) {
        if (isChunkStructural(tiles[y0 * width + x]) && isChunkStructural(tiles[(y0 - 1) * width + x])) return true
      }
    }
    return false
  }
}
