/// <reference lib="webworker" />
import { CHUNK_SIZE, ENABLE_MATTER_SIM_PROFILING } from '../../../../config.ts'
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
  // 4 mega-groups by (cyParity*2 + cxParity), in real CHUNK_SIZE units, on a
  // FIXED (non-staggered) grid. Each group spans the whole map, so a
  // spatially-concentrated mass can still use the entire worker pool
  // regardless of how tall/spread-out it is — O(1) round trips, not
  // O(active row-span).
  //
  // NOTE: this is a deliberate, final choice — a fixed grid causes a real,
  // structural cosmetic artifact (permanent bunching of falling matter at
  // chunk-row boundaries), and several offset/staggering schemes were tried
  // to fix it (alternating round order, staggering the grid origin per
  // frame with 2/16 discrete offsets, bit-reversed offset order). All either
  // failed to remove the artifact or cost significant performance for a
  // fixed-scenario snapshot as large as ~200k active tiles, at which point
  // the user decided the cosmetic artifact is an acceptable tradeoff and
  // asked to revert to this plain fixed-grid version for max performance.
  // Do not reintroduce staggering without reading memory
  // `project-sim-dispatch-jam` first — it documents exactly what was tried
  // and why each attempt didn't pan out.
  //
  // Dispatch used to bin at a finer sub-chunk granularity than CHUNK_SIZE
  // (DISPATCH_CHUNK_SIZE), decoupled from the real terrain chunk grid, to
  // improve worker load-balancing — that mattered a lot in an earlier
  // sequential-row-sweep dispatch scheme, but was later A/B tested directly
  // against this whole-map 4-group scheme (which already keeps the pool busy
  // on its own, since each group spans every real chunk in the map) and
  // showed no measurable throughput difference — same tiles/ms at multiple
  // scales, sub-chunked or not. Removed accordingly, see
  // `project-sim-dispatch-jam` memory for the comparison data. This also
  // means only one worker ever touches a given real chunk's tiles per round
  // again, restoring the invariant that lets ChunkGrid's renderGen/collGen
  // counters be plain increments rather than needing Atomics.
  private readonly megaGroups: number[][] = [[], [], [], []]
  private readonly chunkToWorkerId = new Map<number, number>()
  private workerBatches: number[][] = []
  private chunksWide: number
  private readonly _dirtyChunksThisStep = new Set<number>()
  private readonly onReady: () => void
  private readonly onSpawnParticle: (msg: SimOutMsgSpawnParticle) => void

  // Profiling state, gated by ENABLE_MATTER_SIM_PROFILING. Aggregates
  // per-second so we can see step duration / round-trip count correlated
  // with how much matter is simultaneously active/falling.
  private _profWindowStart = performance.now()
  private _profStepCount = 0
  private _profTotalDur = 0
  private _profMaxDur = 0
  private _profTotalRoundTrips = 0
  private _profMaxRoundTrips = 0
  private _profMaxSnapshot = 0
  private _profMaxBusyWorkers = 0
  private _profMaxBatchSize = 0

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
    this.pendingResolvers = new Array(poolSize).fill(null)
    this.workerBatches = Array.from({ length: poolSize }, () => [])

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
    const _profT0 = ENABLE_MATTER_SIM_PROFILING ? performance.now() : 0
    let _profRoundTrips = 0
    this._dirtyChunksThisStep.clear()
    const { width, chunksWide, megaGroups, chunkToWorkerId, workerBatches, promises } = this

    // Clear buckets
    for (const g of megaGroups) g.length = 0

    for (const idx of snapshot) {
      const tx = idx % width
      const ty = idx / width | 0
      const cx = tx / CHUNK_SIZE | 0
      const cy = ty / CHUNK_SIZE | 0
      megaGroups[(cy & 1) * 2 + (cx & 1)].push(idx)
    }

    for (let g = 0; g < 4; g++) {
      const group = megaGroups[g]
      if (group.length === 0) continue
      if (ENABLE_MATTER_SIM_PROFILING) _profRoundTrips++

      // Sort bottom-up so a tile that falls into another queued cell's slot
      // (within the same chunk) is never double-processed — group can span
      // the whole map, but only same-chunk entries can ever be adjacent, so
      // a single global sort covers every such case.
      group.sort((a, b) => (b / width | 0) - (a / width | 0))

      chunkToWorkerId.clear()
      for (const batch of workerBatches) batch.length = 0
      let next = 0

      for (const idx of group) {
        const tx = idx % width
        const ty = idx / width | 0
        const cx = tx / CHUNK_SIZE | 0
        const cy = ty / CHUNK_SIZE | 0
        const chunkIdx = cy * chunksWide + cx
        this._dirtyChunksThisStep.add(chunkIdx)

        let workerIdx = chunkToWorkerId.get(chunkIdx)
        if (workerIdx === undefined) {
          chunkToWorkerId.set(chunkIdx, next)
          workerIdx = next
          next = (next + 1) % this.size
        }
        workerBatches[workerIdx].push(idx)
      }

      // Load-balance check: are round trips using the whole worker pool, or
      // funneling most tiles through a handful of workers because the
      // active tiles only span a few distinct chunks?
      if (ENABLE_MATTER_SIM_PROFILING) {
        let _profBusyWorkers = 0
        let _profBatchMax = 0
        for (let i = 0; i < this.size; i++) {
          const len = workerBatches[i].length
          if (len === 0) continue
          _profBusyWorkers++
          if (len > _profBatchMax) _profBatchMax = len
        }
        if (_profBusyWorkers > this._profMaxBusyWorkers) this._profMaxBusyWorkers = _profBusyWorkers
        if (_profBatchMax > this._profMaxBatchSize) this._profMaxBatchSize = _profBatchMax
      }

      promises.length = 0
      for (let i = 0; i < this.size; i++) {
        if (workerBatches[i].length === 0) continue
        promises.push(this.dispatch(i, workerBatches[i], leftFirst, frame))
      }

      const results = await Promise.all(promises)
      cb(results)
    }

    // Logs a 1s-aggregated summary so step duration and round-trip count can
    // be correlated against how much is active/falling.
    if (ENABLE_MATTER_SIM_PROFILING) {
      const _profDur = performance.now() - _profT0
      this._profStepCount++
      this._profTotalDur += _profDur
      if (_profDur > this._profMaxDur) this._profMaxDur = _profDur
      this._profTotalRoundTrips += _profRoundTrips
      if (_profRoundTrips > this._profMaxRoundTrips) this._profMaxRoundTrips = _profRoundTrips
      if (snapshot.size > this._profMaxSnapshot) this._profMaxSnapshot = snapshot.size
      const _profNow = performance.now()
      if (_profNow - this._profWindowStart > 1000) {
        const n = this._profStepCount || 1
        console.log(
          `[PROFILE SimWorkerPool] steps=${this._profStepCount} `
          + `avgDur=${(this._profTotalDur / n).toFixed(2)}ms maxDur=${this._profMaxDur.toFixed(2)}ms `
          + `avgRoundTrips=${(this._profTotalRoundTrips / n).toFixed(1)} maxRoundTrips=${this._profMaxRoundTrips} `
          + `maxSnapshotSize=${this._profMaxSnapshot} `
          + `poolSize=${this.size} maxBusyWorkers=${this._profMaxBusyWorkers} maxBatchSize=${this._profMaxBatchSize}`,
        )
        this._profWindowStart = _profNow
        this._profStepCount = 0
        this._profTotalDur = 0
        this._profMaxDur = 0
        this._profTotalRoundTrips = 0
        this._profMaxRoundTrips = 0
        this._profMaxSnapshot = 0
        this._profMaxBusyWorkers = 0
        this._profMaxBatchSize = 0
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
