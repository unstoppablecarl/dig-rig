/// <reference lib="webworker" />
import { CHUNK_SIZE } from '../../../../config.ts'
import type { ChunkGridBuffers } from '../../../Tilemap/ChunkGrid.ts'
import { type SimOutMessage, SimOutMsg, type SimOutMsgDone, type SimOutMsgSpawnParticle } from '../MatterSim/MatterSim.types.ts'
import { MatterSimController } from '../MatterSim/MatterSimController.ts'

export class SimWorkerPool {
  private readonly pool: MatterSimController[] = []
  private readonly pendingResolvers: (((r: SimOutMsgDone) => void) | null)[]
  private readyCount = 0
  private width: number
  private readonly promises: Promise<SimOutMsgDone>[] = []
  private readonly rounds: number[][] = [[], [], [], []]
  private readonly chunkMap = new Map<number, number>()
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
      chunkGridBuffers,
      width,
      height,
      onReady,
      onSpawnParticle,
      poolSize,
    }: {
      tilesBuffer: SharedArrayBuffer
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
    const { rounds, width, promises } = this
    rounds[0].length = 0
    rounds[1].length = 0
    rounds[2].length = 0
    rounds[3].length = 0

    for (const idx of snapshot) {
      const cx = (idx % width) / CHUNK_SIZE | 0
      const cy = (idx / width | 0) / CHUNK_SIZE | 0
      rounds[(cx & 1) | ((cy & 1) << 1)].push(idx)
    }

    for (const roundIndices of rounds) {
      if (roundIndices.length === 0) continue

      const { chunkMap, workerBatches, chunksWide } = this
      chunkMap.clear()
      for (const batch of workerBatches) batch.length = 0
      let w = 0
      for (const idx of roundIndices) {
        const cx = (idx % width) / CHUNK_SIZE | 0
        const cy = (idx / width | 0) / CHUNK_SIZE | 0
        const key = cy * chunksWide + cx
        this._dirtyChunksThisStep.add(key)
        let workerIdx = chunkMap.get(key)
        if (workerIdx === undefined) {
          workerIdx = w
          chunkMap.set(key, w)
          w = (w + 1) % this.size
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
