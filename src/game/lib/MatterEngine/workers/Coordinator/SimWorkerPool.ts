/// <reference lib="webworker" />
import { CHUNK_SIZE, ENABLE_MATTER_SIM_PROFILING } from '../../../../config.ts'
import type { ChunkGridBuffers } from '../../../Tilemap/ChunkGrid.ts'
import {
  type SimOutMessage,
  SimOutMsg,
  type SimOutMsgDone,
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
  //
  // Also tried (and reverted): when a round has more distinct chunks than
  // workers, pigeonhole forces some worker to take 2+ whole chunks — LPT
  // below can't fix that (it can only move whole chunks, not shrink them).
  // Splitting each such chunk's tiles top/bottom and running the bottom half
  // as an immediate extra round (safe: never concurrent with anything, since
  // it runs strictly after the main round's writes complete) does shrink the
  // worst single batch — but it doubles the round-trip count for that
  // mega-group, and measured on the BENCH level (_scripts/bench-sim.mjs,
  // ~200k active tiles, one real chunk fully saturated) it made steady-state
  // throughput ~20% WORSE (round-trip overhead cost more than the smaller
  // batches saved), while maxImbalanceRatio was unchanged (splitting shrinks
  // the absolute batch size, not the ratio, since the same chunk-count vs
  // worker-count mismatch recurs at half scale in each smaller round). Don't
  // reintroduce this without a benchmark showing a net win.
  private readonly megaGroups: number[][] = [[], [], [], []]
  private readonly chunkToWorkerId = new Map<number, number>()
  // Reused scratch state for greedy least-loaded chunk-to-worker assignment
  // (see comment in step()) — cleared and refilled every round trip.
  private readonly chunkSizeMap = new Map<number, number>()
  private readonly chunkIdxScratch: number[] = []
  private readonly workerLoad: number[] = []
  private workerBatches: number[][] = []
  private chunksWide: number
  private readonly _dirtyChunksThisStep = new Set<number>()
  private readonly onReady: () => void

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
  // Per-round-trip imbalance: batchMax / (roundTiles / poolSize), i.e. how
  // far the slowest worker's batch is from a perfectly-even split of that
  // SPECIFIC round's tiles (mega-groups are rarely equal-sized, so dividing
  // the aggregated maxSnapshotSize by 4 rounds would compare batches against
  // the wrong denominator).
  private _profMaxImbalanceRatio = 0
  private _profMaxImbalanceRoundTiles = 0

  get size(): number {
    return this.pool.length
  }

  constructor(
    {
      tilesBuffer,
      fillBuffer,
      chunkGridBuffers,
      particleSpawnBuffer,
      width,
      height,
      onReady,
      poolSize,
    }: {
      tilesBuffer: SharedArrayBuffer
      fillBuffer: SharedArrayBuffer
      chunkGridBuffers: ChunkGridBuffers
      particleSpawnBuffer: SharedArrayBuffer,
      width: number
      height: number
      onReady: () => void,
      poolSize: number,
    },
  ) {
    this.onReady = onReady
    this.width = width
    this.chunksWide = chunkGridBuffers.chunksWide
    this.pendingResolvers = new Array(poolSize).fill(null)
    this.workerBatches = Array.from({ length: poolSize }, () => [])

    const simConfig = {
      tilesBuffer: tilesBuffer,
      fillBuffer: fillBuffer,
      chunkBuffers: chunkGridBuffers,
      particleSpawnBuffer,
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
    const { width, chunksWide, megaGroups, chunkToWorkerId, workerBatches } = this

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

      // Sort bottom-up so a tile that falls into another queued cell's slot
      // (within the same chunk) is never double-processed — group can span
      // the whole map, but only same-chunk entries can ever be adjacent, so
      // a single global sort covers every such case.
      group.sort((a, b) => (b / width | 0) - (a / width | 0))

      chunkToWorkerId.clear()
      this.chunkSizeMap.clear()
      this.chunkIdxScratch.length = 0
      for (const batch of workerBatches) batch.length = 0

      // Pass 1: compute each tile's chunkIdx once (cached for pass 3, instead
      // of recomputing it below) and tally tiles-per-chunk.
      for (const idx of group) {
        const tx = idx % width
        const ty = idx / width | 0
        const cx = tx / CHUNK_SIZE | 0
        const cy = ty / CHUNK_SIZE | 0
        const chunkIdx = cy * chunksWide + cx
        this.chunkIdxScratch.push(chunkIdx)
        this._dirtyChunksThisStep.add(chunkIdx)
        this.chunkSizeMap.set(chunkIdx, (this.chunkSizeMap.get(chunkIdx) ?? 0) + 1)
      }

      // Pass 2: greedy least-loaded assignment (LPT — largest chunks first)
      // instead of round-robin-on-first-seen. A chunk's tiles must all stay
      // on one worker (write-conflict invariant), but round-robin could
      // still stack several heavy chunks on the same worker while others sat
      // idle — this keeps per-round-trip wall time closer to
      // totalTiles / poolSize instead of being bottlenecked by whichever
      // worker got unlucky. poolSize is small (~10), so a linear scan for
      // the least-loaded worker per distinct chunk is cheap.
      const chunkEntries = Array.from(this.chunkSizeMap.entries())
      chunkEntries.sort((a, b) => b[1] - a[1])

      const workerLoad = this.workerLoad
      workerLoad.length = this.size
      workerLoad.fill(0)

      for (const [chunkIdx, size] of chunkEntries) {
        let best = 0
        for (let i = 1; i < this.size; i++) {
          if (workerLoad[i] < workerLoad[best]) best = i
        }
        chunkToWorkerId.set(chunkIdx, best)
        workerLoad[best] += size
      }

      // Pass 3: push tiles into their assigned worker's batch, preserving
      // the row-descending order from the sort above.
      for (let i = 0; i < group.length; i++) {
        const idx = group[i]
        const chunkIdx = this.chunkIdxScratch[i]
        const workerIdx = chunkToWorkerId.get(chunkIdx)!
        workerBatches[workerIdx].push(idx)
      }

      _profRoundTrips += await this.dispatchWave(workerBatches, group.length, leftFirst, frame, cb)
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
          + `poolSize=${this.size} maxBusyWorkers=${this._profMaxBusyWorkers} maxBatchSize=${this._profMaxBatchSize} `
          + `maxImbalanceRatio=${this._profMaxImbalanceRatio.toFixed(2)} (roundTiles=${this._profMaxImbalanceRoundTiles})`,
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
        this._profMaxImbalanceRatio = 0
        this._profMaxImbalanceRoundTiles = 0
      }
    }

    return this._dirtyChunksThisStep
  }

  // Dispatches whatever's currently in workerBatches as one round trip
  // (profiling + actual dispatch + await). Returns 1 so the caller can just
  // sum round-trip counts. roundTiles is the total tile count this round
  // covers — used as the imbalance-ratio denominator, since mega-groups are
  // rarely equal-sized (see comment above).
  private async dispatchWave(
    workerBatches: number[][],
    roundTiles: number,
    leftFirst: boolean,
    frame: number,
    cb: (results: SimOutMsgDone[]) => void,
  ): Promise<number> {
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
      const _profRatio = _profBatchMax / (roundTiles / this.size)
      if (_profRatio > this._profMaxImbalanceRatio) {
        this._profMaxImbalanceRatio = _profRatio
        this._profMaxImbalanceRoundTiles = roundTiles
      }
    }

    const { promises } = this
    promises.length = 0
    for (let i = 0; i < this.size; i++) {
      if (workerBatches[i].length === 0) continue
      promises.push(this.dispatch(i, workerBatches[i], leftFirst, frame))
    }

    const results = await Promise.all(promises)
    cb(results)
    return 1
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

  private _onMessage(workerIdx: number, msg: SimOutMessage) {
    if (msg.type === SimOutMsg.READY) {
      if (++this.readyCount === this.pool.length) this.onReady()
      return
    }
    this.pendingResolvers[workerIdx]?.(msg)
    this.pendingResolvers[workerIdx] = null
  }
}
