/// <reference lib="webworker" />
import {
  EMPTY,
  getSupport,
  matterType,
  MatterType,
  SupportType,
} from './_Matter.types.ts'
import { type CoordinatorInMessageApplyEffect, type CoordinatorOutMessage, CoordinatorOutMsg } from './MatterCoordinator.types.ts'
import { MatterSim } from './MatterSim.ts'
import {
  SETTLING_TYPES,
  getSupportType,
  STRUCTURAL_COLLAPSE_TO,
  setSupport,
} from './matter.ts'
import { type SimOutMessage, SimOutMsg, type SimOutMsgDone } from './MatterSim.types.ts'
import { MatterSimWorkerController } from './MatterSimWorkerController.ts'
import { FireMode } from '../Player/_FireMode-types.ts'
import type { ProjectileEffectResult } from '../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import { convertMatterTile } from '../Projectiles/ProjectileEffect/convertMatterTile.ts'
import type { MatterTankId } from './MatterTank/_MatterTank.types.ts'

const BFS_DX = [-1, 1, 0, 0]
const BFS_DY = [0, 0, -1, 1]

type EffectRequest = CoordinatorInMessageApplyEffect

export class MatterCoordinator {
  constructor(private readonly post: (msg: CoordinatorOutMessage, transfer?: Transferable[]) => void) {
  }

  private sim!: MatterSim
  private pool: MatterSimWorkerController[] = []
  private pendingResolvers: (((r: SimOutMsgDone) => void) | null)[] = []
  private readyCount = 0

  private readonly setA = new Set<number>()
  private readonly setB = new Set<number>()
  activeSet = this.setA
  private idleSet = this.setB
  private frame = 0
  private width = 0
  private height = 0
  private chunkSize = 0
  private readonly rounds: number[][] = [[], [], [], []]
  private readonly allSettled: number[] = []
  private coordinatorTransfers = makeTransferCoordinator()
  private readonly promises: Promise<SimOutMsgDone>[] = []
  private chunksWide = 0
  private readonly chunkMap = new Map<number, number[]>()
  private workerBatches: number[][] = []
  private writeQueue: {
    indices: number[]
    tile: number,
  }[] = []
  private effectQueue: EffectRequest[] = []

  // Pre-allocated BFS buffers for island detection in processEffect.
  private _bfsVisited!: Uint8Array
  private _bfsQueue!: Int32Array
  private _bfsComp!: Int32Array

  init(
    tilesBuffer: SharedArrayBuffer,
    dirtyChunksBuffer: SharedArrayBuffer,
    width: number,
    height: number,
    chunkSize: number,
    poolSize: number,
  ) {
    this.width = width
    this.height = height
    this.chunkSize = chunkSize
    this.chunksWide = Math.ceil(width / chunkSize)
    this.workerBatches = Array.from({ length: poolSize }, () => [])

    this.sim = new MatterSim()
    this.sim.init(tilesBuffer, dirtyChunksBuffer, width, height, chunkSize)

    const n = width * height
    this._bfsVisited = new Uint8Array(n)
    this._bfsQueue = new Int32Array(n)
    this._bfsComp = new Int32Array(n)

    this.pendingResolvers = new Array(poolSize).fill(null)

    for (let i = 0; i < poolSize; i++) {
      const poolWorker = new MatterSimWorkerController({
          tilesBuffer,
          dirtyChunksBuffer,
          width,
          height,
          chunkSize,
        }, (e) => this.onPoolMessage(i, e.data),
      )

      this.pool.push(poolWorker)
    }
  }

  activate(indices: number[]) {
    this.sim.activate(indices, this.activeSet)
  }

  check(tx: number, ty: number) {
    this.sim.reactivateAround(tx, ty, this.activeSet)
  }

  write(indices: number[], tile: number) {
    this.writeQueue.push({ indices, tile })
  }

  applyEffect(req: EffectRequest) {
    this.effectQueue.push(req)
  }

  private onPoolMessage(workerIdx: number, msg: SimOutMessage | CoordinatorOutMessage) {
    if (msg.type === SimOutMsg.READY) {
      this.readyCount++
      if (this.readyCount === this.pool.length) this.startLoop()
      return
    }
    if (msg.type === SimOutMsg.DONE) {
      this.pendingResolvers[workerIdx]?.(msg)
      this.pendingResolvers[workerIdx] = null
      return
    }

    this.post(msg as CoordinatorOutMessage)
  }

  private sendToWorker(
    workerIdx: number,
    indices: number[],
    leftFirst: boolean,
    frame: number,
  ): Promise<SimOutMsgDone> {
    return new Promise(resolve => {
      this.pendingResolvers[workerIdx] = resolve
      this.pool[workerIdx].process(
        indices,
        leftFirst,
        frame,
      )
    })
  }

  private startLoop() {
    const loop = async () => {
      await this.step()
      setTimeout(loop, 8)
    }
    setTimeout(loop, 8)
  }

  private async step() {
    if (this.activeSet.size === 0 && this.effectQueue.length === 0) return

    const frame = this.frame++
    const leftFirst = (frame % 2) === 0

    // Swap sets before draining effects so new activations land in the fresh
    // activeSet and are picked up next step (after the committed writes settle).
    const snapshot = this.activeSet
    this.activeSet = this.idleSet
    this.idleSet = snapshot

    // clear fresh active set
    this.activeSet.clear()

    // Drain effect queue — writes are committed to SAB here, before any sim
    // round runs, so sim workers see the updated tile state this step.
    for (const req of this.effectQueue) {
      this.processEffect(req)
    }
    this.effectQueue.length = 0

    const { rounds, width, chunkSize, allSettled, promises } = this
    rounds[0].length = 0
    rounds[1].length = 0
    rounds[2].length = 0
    rounds[3].length = 0
    allSettled.length = 0
    this.coordinatorTransfers.reset()

    // Partition snapshot into 4 checkerboard parity groups by chunk coords.
    // parity = (cx & 1) | ((cy & 1) << 1) → 0=A  1=B  2=C  3=D
    // Same-round chunks are always ≥1 chunk apart — safe for parallel writes.
    for (const idx of snapshot) {
      const cx = (idx % width) / chunkSize | 0
      const cy = (idx / width | 0) / chunkSize | 0
      rounds[(cx & 1) | ((cy & 1) << 1)].push(idx)
    }

    for (const roundIndices of rounds) {
      if (roundIndices.length === 0) continue

      // Group tiles by chunk, assign whole chunks round-robin to workers.
      // All tiles from a given chunk go to one worker, so intra-chunk tile
      // processing is sequential — no concurrent diagonal write races.
      const { chunkMap, workerBatches, chunksWide } = this
      chunkMap.clear()
      for (const idx of roundIndices) {
        const cx = (idx % this.width) / this.chunkSize | 0
        const cy = (idx / this.width | 0) / this.chunkSize | 0
        const key = cy * chunksWide + cx
        let bucket = chunkMap.get(key)
        if (!bucket) {
          chunkMap.set(key, [idx])
        } else {
          bucket.push(idx)
        }
      }

      for (const batch of workerBatches) batch.length = 0
      let w = 0
      for (const chunkTiles of chunkMap.values()) {
        const batch = workerBatches[w]
        for (const idx of chunkTiles) batch.push(idx)
        w = (w + 1) % this.pool.length
      }

      promises.length = 0
      for (let i = 0; i < this.pool.length; i++) {
        if (workerBatches[i].length === 0) continue
        promises.push(this.sendToWorker(i, workerBatches[i], leftFirst, frame))
      }

      const results = await Promise.all(promises)
      for (const r of results) {
        for (const idx of r.next) this.activeSet.add(idx)
        for (const idx of r.settled) allSettled.push(idx)
        if (r.transfers.length > 0) {
          this.coordinatorTransfers.add(r.transfers)
        }
      }
    }

    if (allSettled.length > 0) {
      // A tile can settle in an early round and be re-activated by a later round
      // in the same step. Tiles that ended up back in the active set are not settled
      // for vfx purposes.
      const toFlash = allSettled.filter(idx => !this.activeSet.has(idx))
      if (toFlash.length > 0) {
        this.post({ type: CoordinatorOutMsg.SETTLED, indices: toFlash })
      }
    }

    if (this.coordinatorTransfers.length > 0) {
      const transfers = this.coordinatorTransfers.flush()
      this.post(
        { type: CoordinatorOutMsg.TRANSFER_TO_MATTER_TANKS, transfers },
        [transfers.buffer],
      )
    }
  }

  // Applies a projectile effect entirely within the worker:
  //   1. Scans the circle, filters tiles, computes new values
  //   2. Writes committed tiles to the SAB and marks dirty chunks
  //   3. Re-activates neighbors of emptied tiles
  //   4. Runs onTilesCommitted equivalent (island BFS, liquid activation)
  //   5. Posts APPLY_EFFECT_RESULT back to the main thread
  private processEffect(req: EffectRequest) {
    const { width, height } = this
    const tiles = this.sim.tiles
    const {
      mode, createType, tileX, tileY, tileRadius, innerRadius, ownerId,
      tilesToModify, playerBoundsLeft, playerBoundsRight, playerBoundsTop, playerBoundsBot,
    } = req

    // --- Phase 1: collect candidates ---
    const candidates: ProjectileEffectResult[] = []
    const r2 = tileRadius * tileRadius
    const ir2 = innerRadius * innerRadius
    const minY = Math.max(0, Math.floor(tileY - tileRadius))
    const maxY = Math.min(height - 1, Math.ceil(tileY + tileRadius))

    for (let y = minY; y <= maxY; y++) {
      const dy = y - tileY
      const dy2 = dy * dy
      if (dy2 > r2) continue
      const outerDx = Math.sqrt(r2 - dy2)
      const xMin = Math.max(0, Math.ceil(tileX - outerDx))
      const xMax = Math.min(width - 1, Math.floor(tileX + outerDx))

      if (innerRadius > 0 && dy2 <= ir2) {
        const innerDx = Math.sqrt(ir2 - dy2)
        const xSkipStart = Math.ceil(tileX - innerDx)
        const xSkipEnd = Math.floor(tileX + innerDx)
        for (let x = xMin; x < xSkipStart; x++) this._tryCandidate(candidates, tiles, x, y, mode, createType, ownerId, playerBoundsLeft, playerBoundsRight, playerBoundsTop, playerBoundsBot)
        for (let x = xSkipEnd + 1; x <= xMax; x++) this._tryCandidate(candidates, tiles, x, y, mode, createType, ownerId, playerBoundsLeft, playerBoundsRight, playerBoundsTop, playerBoundsBot)
      } else {
        for (let x = xMin; x <= xMax; x++) this._tryCandidate(candidates, tiles, x, y, mode, createType, ownerId, playerBoundsLeft, playerBoundsRight, playerBoundsTop, playerBoundsBot)
      }
    }

    // --- Phase 2: truncate to tilesToModify (sort by dist from center) ---
    if (tilesToModify < candidates.length) {
      candidates.sort((a, b) =>
        ((a.x - tileX) ** 2 + (a.y - tileY) ** 2) - ((b.x - tileX) ** 2 + (b.y - tileY) ** 2),
      )
      candidates.length = tilesToModify
    }

    if (candidates.length === 0) {
      if (req.requestId !== 0) {
        this.post({
          type: CoordinatorOutMsg.APPLY_EFFECT_RESULT,
          requestId: req.requestId,
          mode,
          tilesModified: 0,
          tiles: [],
        })
      }
      return
    }

    // --- Phase 3: write tiles to SAB, mark dirty chunks, wake neighbors ---
    for (const { x, y, newValue } of candidates) {
      const idx = y * width + x
      tiles[idx] = newValue
      this.sim.markDirty(x, y)
      if (newValue === EMPTY) {
        this.sim.reactivateAround(x, y, this.activeSet)
      }
    }

    // --- Phase 4: onTilesCommitted equivalent ---
    if (mode === FireMode.DESTROY || mode === FireMode.MELT) {
      // re-activate the changed liquid/sand tiles (for MELT)
      if (mode === FireMode.MELT) {
        const indices = candidates.map(({ x, y }) => y * width + x)
        this.sim.activate(indices, this.activeSet)
      }
      const islands = this._findNewlyDisconnected(candidates)
      if (islands.length > 0) {
        this._collapseIslands(islands)
      }
    } else if (mode === FireMode.CREATE) {
      if (SETTLING_TYPES.has(createType)) {
        const indices = candidates.map(({ x, y }) => y * width + x)
        this.sim.activate(indices, this.activeSet)
      }
    } else if (mode === FireMode.SOLIDIFY) {
      // re-activate the changed tiles
      const indices = candidates.map(({ x, y }) => y * width + x)
      this.sim.activate(indices, this.activeSet)
      // island check only for tiles that became SOLID
      const solidTiles = candidates.filter(t => t.newValue === MatterType.SOLID)
      if (solidTiles.length > 0) {
        const islands = this._findIslandTiles(solidTiles)
        if (islands.length > 0) this._collapseIslands(islands)
      }
    }

    // --- Phase 5: post result back to main thread ---
    if (req.requestId !== 0) {
      this.post({
        type: CoordinatorOutMsg.APPLY_EFFECT_RESULT,
        requestId: req.requestId,
        mode,
        tilesModified: candidates.length,
        tiles: candidates,
      })
    }
  }

  private _tryCandidate(
    out: ProjectileEffectResult[],
    tiles: Uint32Array,
    x: number, y: number,
    mode: FireMode, createType: MatterType, ownerId: MatterTankId,
    left: number, right: number, top: number, bot: number,
  ) {
    if (mode === FireMode.CREATE) {
      if (x > left && x < right && y > top && y < bot) return
    }
    const existing = matterType(tiles[y * this.width + x])
    const newValue = convertMatterTile(mode, createType, existing, ownerId)
    if (newValue !== null) out.push({ x, y, newValue })
  }

  // Port of Tilemap.findNewlyDisconnectedByDestruction using pre-allocated buffers.
  private _findNewlyDisconnected(destroyedTiles: { x: number; y: number }[]): { x: number; y: number }[] {
    const { width, height, _bfsVisited: vis, _bfsQueue: queue, _bfsComp: comp } = this
    const tiles = this.sim.tiles
    vis.fill(0)

    const islandTiles: { x: number; y: number }[] = []

    for (const { x: dx, y: dy } of destroyedTiles) {
      for (let d = 0; d < 4; d++) {
        const sx = dx + BFS_DX[d], sy = dy + BFS_DY[d]
        if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue
        const sidx = sy * width + sx
        if (vis[sidx] !== 0) continue
        const supportType = getSupportType(tiles[sidx])
        if (supportType < SupportType.STRUCTURAL) continue
        if (supportType === SupportType.ANCHORED) { vis[sidx] = 2; continue }

        let seedAnchored = sx === 0 || sx === width - 1 || sy === 0 || sy === height - 1
        if (!seedAnchored) {
          for (let dp = 0; dp < 4; dp++) {
            const px = sx + BFS_DX[dp], py = sy + BFS_DY[dp]
            if (px < 0 || px >= width || py < 0 || py >= height) { seedAnchored = true; break }
            if (getSupportType(tiles[py * width + px]) === SupportType.ANCHORED) { seedAnchored = true; break }
          }
        }
        if (seedAnchored) { vis[sidx] = 2; continue }

        let head = 0, tail = 0, compLen = 0, anchored = false
        vis[sidx] = 1
        queue[tail++] = sidx
        comp[compLen++] = sidx

        bfs: while (head < tail) {
          const cidx = queue[head++]
          const cx = cidx % width
          const cy = (cidx / width) | 0

          for (let d2 = 0; d2 < 4; d2++) {
            const nx = cx + BFS_DX[d2], ny = cy + BFS_DY[d2]
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) { anchored = true; break bfs }
            const nidx = ny * width + nx
            if (vis[nidx] !== 0) continue
            const nt = tiles[nidx]
            const st = getSupportType(nt)
            if (st === SupportType.ANCHORED) { anchored = true; break bfs }
            if (st >= SupportType.STRUCTURAL) {
              vis[nidx] = 1
              queue[tail++] = nidx
              comp[compLen++] = nidx
            }
          }
        }

        for (let k = 0; k < compLen; k++) vis[comp[k]] = 2
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

  // Port of Tilemap.findIslandTiles (without chunk-level pre-filter).
  private _findIslandTiles(newTiles: { x: number; y: number }[]): { x: number; y: number }[] {
    if (newTiles.length === 0) return []
    const { width, height } = this
    const tiles = this.sim.tiles

    const newSet = new Set<number>(newTiles.map(({ x, y }) => y * width + x))

    let touchesStructural = false
    for (const { x, y } of newTiles) {
      for (let d = 0; d < 4; d++) {
        const nx = x + BFS_DX[d], ny = y + BFS_DY[d]
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) return [] // edge = anchored
        const nidx = ny * width + nx
        if (newSet.has(nidx)) continue
        const st = getSupportType(tiles[nidx])
        if (st === SupportType.ANCHORED) return []
        if (st >= SupportType.STRUCTURAL) touchesStructural = true
      }
    }

    if (!touchesStructural) return newTiles

    const visited = new Set<number>(newSet)
    const queue: [number, number][] = newTiles.map(({ x, y }) => [x, y] as [number, number])
    let head = 0, anchored = false

    outer: while (head < queue.length) {
      const [x, y] = queue[head++]
      for (let d = 0; d < 4; d++) {
        const nx = x + BFS_DX[d], ny = y + BFS_DY[d]
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) { anchored = true; break outer }
        const nidx = ny * width + nx
        if (visited.has(nidx)) continue
        visited.add(nidx)
        const st = getSupportType(tiles[nidx])
        if (st === SupportType.ANCHORED) { anchored = true; break outer }
        if (st >= SupportType.STRUCTURAL) queue.push([nx, ny])
      }
    }

    return anchored ? [] : newTiles
  }

  private _collapseIslands(islands: { x: number; y: number }[]) {
    const tiles = this.sim.tiles
    const { width } = this
    const toActivate: number[] = []

    for (const { x, y } of islands) {
      const idx = y * width + x
      const raw = tiles[idx]
      const t = matterType(raw)
      const collapseType = STRUCTURAL_COLLAPSE_TO[t]
      if (collapseType !== undefined) {
        tiles[idx] = collapseType
        this.sim.markDirty(x, y)
        toActivate.push(idx)
      } else if (getSupport(raw) === SupportType.STRUCTURAL) {
        const cleared = setSupport(raw, SupportType.NONE)
        tiles[idx] = cleared
        this.sim.markDirty(x, y)
        toActivate.push(idx)
      }
    }

    if (toActivate.length > 0) {
      this.sim.activate(toActivate, this.activeSet)
    }
  }
}

function makeTransferCoordinator() {
  let coordinatorTransfers = new Int32Array(256 * 3)
  let currentLength = 0

  return {
    add(transfers: Int32Array) {
      const needed = currentLength + transfers.length
      // grow if needed
      if (needed > coordinatorTransfers.length) {
        const bigger = new Int32Array(Math.max(coordinatorTransfers.length * 2, needed))
        bigger.set(coordinatorTransfers.subarray(0, currentLength))
        coordinatorTransfers = bigger
      }
      coordinatorTransfers.set(transfers, currentLength)
      currentLength += transfers.length
    },

    flush() {
      const len = currentLength
      const oldCapacity = coordinatorTransfers.length
      const buf = coordinatorTransfers.buffer
      coordinatorTransfers = new Int32Array(Math.max(256 * 3, oldCapacity))
      currentLength = 0
      return new Int32Array(buf, 0, len)
    },
    get length() {
      return currentLength
    },
    reset() {
      currentLength = 0
    },
  }
}
