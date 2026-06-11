/// <reference lib="webworker" />
import {
  type PoolInMessage,
  PoolInMsg,
  type PoolOutDone,
  type PoolOutMessage,
  PoolOutMsg,
} from './MatterCoordinator.types.ts'
import { MatterSim } from './MatterSim.ts'
import { MatterCoordinatorOutMsg, type WorkerOutMessage } from './MatterSim.types.ts'

export class MatterCoordinator {
  constructor(private readonly post: (msg: WorkerOutMessage, transfer?: Transferable[]) => void) {
  }

  private sim!: MatterSim
  private pool: Worker[] = []
  // Per-worker slot for the resolve of the in-flight PROCESS promise.
  private pendingResolvers: (((r: PoolOutDone) => void) | null)[] = []
  private readyCount = 0

  // Two pre-allocated sets that swap roles each step: one is activeSet (receives
  // ACTIVATE/CHECK additions), the other is the snapshot being processed.
  private readonly setA = new Set<number>()
  private readonly setB = new Set<number>()
  activeSet = this.setA
  private idleSet = this.setB
  private frame = 0
  private width = 0
  private chunkSize = 0
  // 4-round chunk checkerboard — parity = (cx & 1) | ((cy & 1) << 1):
  //
  //   A B A B      A=0  B=1  C=2  D=3
  //   C D C D
  //   A B A B      Every chunk's 8 neighbors are in different rounds, so
  //   C D C D      same-round chunks are always ≥1 chunk apart in both axes.
  //                This makes 8-directional matterType reads safe under parallel
  //                execution: any adjacent tile belongs to an inactive round.
  private readonly rounds: number[][] = [[], [], [], []]
  private readonly allSettled: number[] = []
  private coordinatorTransfers = new Int32Array(256 * 3)
  private coordinatorTransfersLen = 0
  private readonly promises: Promise<PoolOutDone>[] = []

  init(
    tilesBuffer: SharedArrayBuffer,
    dirtyChunksBuffer: SharedArrayBuffer,
    width: number,
    height: number,
    chunkSize: number,
    poolWorkers: Worker[],
  ) {
    this.width = width
    this.chunkSize = chunkSize

    // Coordinator's own MatterSim — used only for activate() and
    // reactivateAround() (tile reads/writes + set population). No step loop.
    this.sim = new MatterSim()
    this.sim.init(tilesBuffer, dirtyChunksBuffer, width, height, chunkSize)

    this.pendingResolvers = new Array(poolWorkers.length).fill(null)

    for (let i = 0; i < poolWorkers.length; i++) {
      const w = poolWorkers[i]
      w.onmessage = (e: MessageEvent<PoolOutMessage | WorkerOutMessage>) => this.onPoolMessage(i, e.data)
      w.postMessage({
        type: PoolInMsg.INIT,
        tilesBuffer,
        dirtyChunksBuffer,
        width,
        height,
        chunkSize,
      } satisfies PoolInMessage)
      this.pool.push(w)
    }
    // startLoop() is called once all pool workers reply READY.
  }

  activate(indices: number[]) {
    this.sim.activate(indices, this.activeSet)
  }

  check(tx: number, ty: number) {
    this.sim.reactivateAround(tx, ty, this.activeSet)
  }

  private onPoolMessage(workerIdx: number, msg: PoolOutMessage | WorkerOutMessage) {
    if (msg.type === PoolOutMsg.READY) {
      this.readyCount++
      if (this.readyCount === this.pool.length) this.startLoop()
      return
    }
    if (msg.type === PoolOutMsg.DONE) {
      this.pendingResolvers[workerIdx]?.(msg)
      this.pendingResolvers[workerIdx] = null
      return
    }

    // SPAWN_PARTICLE and any other matterType-action postMessage calls:
    // pool workers call postMessage() which reaches the coordinator;
    // forward straight to the main thread.
    this.post(msg as WorkerOutMessage)
  }

  private sendToWorker(
    workerIdx: number,
    indices: number[],
    leftFirst: boolean,
    frame: number,
  ): Promise<PoolOutDone> {
    return new Promise(resolve => {
      this.pendingResolvers[workerIdx] = resolve
      this.pool[workerIdx].postMessage({
        type: PoolInMsg.PROCESS,
        indices,
        leftFirst,
        frame,
      } satisfies PoolInMessage)
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
    if (this.activeSet.size === 0) return

    const frame = this.frame++
    const leftFirst = (frame % 2) === 0

    // Swap sets: snapshot holds the tiles to process; activeSet is cleared and
    // becomes the receiver for ACTIVATE/CHECK messages arriving during awaits.
    const snapshot = this.activeSet
    this.activeSet = this.idleSet
    this.idleSet = snapshot

    // clear fresh active set
    this.activeSet.clear()

    const { rounds, width, chunkSize, allSettled, promises } = this
    rounds[0].length = 0
    rounds[1].length = 0
    rounds[2].length = 0
    rounds[3].length = 0

    // Partition snapshot into 4 checkerboard parity groups by chunk coords.
    // parity = (cx & 1) | ((cy & 1) << 1) → 0=A  1=B  2=C  3=D
    // Same-round chunks are always ≥1 chunk apart — safe for parallel writes.
    for (const idx of snapshot) {
      const cx = (idx % width) / chunkSize | 0
      const cy = (idx / width | 0) / chunkSize | 0
      rounds[(cx & 1) | ((cy & 1) << 1)].push(idx)
    }

    allSettled.length = 0
    this.coordinatorTransfersLen = 0

    for (const roundIndices of rounds) {
      if (roundIndices.length === 0) continue

      // Distribute round's indices evenly across pool workers.
      const poolSize = this.pool.length
      const sliceLen = Math.ceil(roundIndices.length / poolSize)
      promises.length = 0

      for (let i = 0; i < poolSize; i++) {
        const start = i * sliceLen
        if (start >= roundIndices.length) break
        promises.push(this.sendToWorker(i, roundIndices.slice(start, start + sliceLen), leftFirst, frame))
      }

      const results = await Promise.all(promises)
      for (const r of results) {
        for (const idx of r.next) this.activeSet.add(idx)
        for (const idx of r.settled) allSettled.push(idx)
        if (r.transfers.length > 0) {
          const needed = this.coordinatorTransfersLen + r.transfers.length
          if (needed > this.coordinatorTransfers.length) {
            const bigger = new Int32Array(Math.max(this.coordinatorTransfers.length * 2, needed))
            bigger.set(this.coordinatorTransfers.subarray(0, this.coordinatorTransfersLen))
            this.coordinatorTransfers = bigger
          }
          this.coordinatorTransfers.set(r.transfers, this.coordinatorTransfersLen)
          this.coordinatorTransfersLen += r.transfers.length
        }
      }
    }

    if (allSettled.length > 0) {
      this.post({ type: MatterCoordinatorOutMsg.SETTLED, indices: allSettled })
    }
    if (this.coordinatorTransfersLen > 0) {
      const len = this.coordinatorTransfersLen
      const buf = this.coordinatorTransfers.buffer
      this.coordinatorTransfers = new Int32Array(Math.max(256 * 3, len))
      this.coordinatorTransfersLen = 0
      this.post(
        { type: MatterCoordinatorOutMsg.TRANSFER_TO_MATTER_TANKS, transfers: new Int32Array(buf, 0, len) },
        [buf],
      )
    }
  }
}
