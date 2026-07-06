/// <reference lib="webworker" />
import { CHUNK_SIZE } from '../../../../config.ts'
import type { ChunkGridBuffers } from '../../../Tilemap/ChunkGrid.ts'
import {
  type SimOutMessage,
  SimOutMsg,
  type SimOutMsgDone,
  type SimOutMsgSpawnParticle,
} from '../MatterSim/MatterSim.types.ts'
import { MatterSimController } from '../MatterSim/MatterSimController.ts'

export class SimWorkerPool {
  private readonly pool: MatterSimController[] = []
  private readonly pendingResolvers: (((r: SimOutMsgDone) => void) | null)[]
  private readyCount = 0
  private width: number
  private readonly promises: Promise<SimOutMsgDone>[] = []
  // Per-cy-row, per-cx-parity buckets: [cy * 2 + cxParity]
  private readonly cyBuckets: number[][]
  private readonly chunksHigh: number
  private readonly chunkToWorkerId = new Map<number, number>()
  private workerBatches: number[][] = []
  private chunksWide: number
  private readonly _dirtyChunksThisStep = new Set<number>()
  private readonly onReady: () => void
  private readonly onSpawnParticle: (msg: SimOutMsgSpawnParticle) => void

  get size(): number {
    return this.pool.length
  }

  constructor(
    {
      tilesBuffer,
      fillBuffer,
      chunkGridBuffers,
      width,
      height,
      onReady,
      onSpawnParticle,
      poolSize,
    }: {
      tilesBuffer: SharedArrayBuffer
      fillBuffer: SharedArrayBuffer
      chunkGridBuffers: ChunkGridBuffers
      width: number
      height: number
      onReady: () => void,
      onSpawnParticle: (msg: SimOutMsgSpawnParticle) => void,
      poolSize: number,
    },
  ) {
    this.onReady = onReady
    this.onSpawnParticle = onSpawnParticle
    this.width = width
    this.chunksWide = chunkGridBuffers.chunksWide
    this.chunksHigh = chunkGridBuffers.chunksHigh
    this.pendingResolvers = new Array(poolSize).fill(null)
    this.workerBatches = Array.from({ length: poolSize }, () => [])
    this.cyBuckets = Array.from({ length: chunkGridBuffers.chunksHigh * 2 }, () => [])

    const simConfig = {
      tilesBuffer: tilesBuffer,
      fillBuffer: fillBuffer,
      chunkBuffers: chunkGridBuffers,
      width: width,
      height: height,
    }
    for (let i = 0; i < poolSize; i++) {
      this.pool.push(new MatterSimController(simConfig, (e) => this._onMessage(i, e.data)))
    }
  }

  async step(snapshot: Set<number>, leftFirst: boolean, frame: number, cb: (results: SimOutMsgDone[]) => void) {
    this._dirtyChunksThisStep.clear()
    const { width, chunksWide, chunksHigh, cyBuckets, chunkToWorkerId, workerBatches, promises } = this

    // Clear buckets
    for (const b of cyBuckets) b.length = 0

    // Bin each active cell into its (cy, cx-parity) bucket
    for (const idx of snapshot) {
      const cx = (idx % width) / CHUNK_SIZE | 0
      const cy = (idx / width | 0) / CHUNK_SIZE | 0
      cyBuckets[cy * 2 + (cx & 1)].push(idx)
    }

    // Sweep bottom-to-top: each cy row vacates before the row above it runs,
    // so cross-boundary cascade works at every chunk boundary in one step.
    // Within each cy row, cx-even and cx-odd run sequentially to prevent
    // horizontal conflicts at cx chunk borders; leftFirst alternates the order.
    for (let cy = chunksHigh - 1; cy >= 0; cy--) {
      for (let p = 0; p < 2; p++) {
        const parity = leftFirst ? p : 1 - p
        const group = cyBuckets[cy * 2 + parity]
        if (group.length === 0) continue

        // Sort bottom-up within the group so cells near the chunk floor fall
        // first, cascading upward through the chunk in a single dispatch.
        group.sort((a, b) => (b / width | 0) - (a / width | 0))

        chunkToWorkerId.clear()
        for (const batch of workerBatches) batch.length = 0
        let next = 0

        for (const idx of group) {
          const cx = (idx % width) / CHUNK_SIZE | 0
          const cy2 = (idx / width | 0) / CHUNK_SIZE | 0
          const cIdx = cy2 * chunksWide + cx
          this._dirtyChunksThisStep.add(cIdx)
          let workerIdx = chunkToWorkerId.get(cIdx)
          if (workerIdx === undefined) {
            chunkToWorkerId.set(cIdx, next)
            workerIdx = next
            next = (next + 1) % this.size
          }
          workerBatches[workerIdx].push(idx)
        }

        promises.length = 0
        for (let i = 0; i < this.size; i++) {
          if (workerBatches[i].length === 0) continue
          promises.push(this.dispatch(i, workerBatches[i], leftFirst, frame))
        }

        const results = await Promise.all(promises)
        cb(results)
      }
    }

    return this._dirtyChunksThisStep
  }

  dispatch(workerIdx: number, indices: number[], leftFirst: boolean, frame: number):
    Promise<SimOutMsgDone> {
    return new Promise(resolve => {
      this.pendingResolvers[workerIdx] = resolve
      this.pool[workerIdx].process(indices, leftFirst, frame)
    })
  }

  terminate() {
    for (const controller of this.pool) controller.terminate()
  }

  private _onMessage(workerIdx: number, msg: SimOutMessage | SimOutMsgSpawnParticle,
  ) {
    if (msg.type === SimOutMsg.READY) {
      if (++this.readyCount === this.pool.length) this.onReady()
      return
    }
    if (msg.type === SimOutMsg.DONE) {
      this.pendingResolvers[workerIdx]?.(msg)
      this.pendingResolvers[workerIdx] = null
      return
    }
    this.onSpawnParticle(msg as SimOutMsgSpawnParticle)
  }
}
