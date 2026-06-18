/// <reference lib="webworker" />
import { type CoordinatorOutMessage, CoordinatorOutMsg } from './MatterCoordinator.types.ts'
import { MatterSim } from './MatterSim.ts'
import { type SimOutMessage, SimOutMsg, type SimOutMsgDone } from './MatterSim.types.ts'
import { MatterSimWorkerController } from './MatterSimWorkerController.ts'

export class MatterCoordinator {
  constructor(private readonly post: (msg: CoordinatorOutMessage, transfer?: Transferable[]) => void) {
  }

  private sim!: MatterSim
  private pool: MatterSimWorkerController[] = []
  // Per-worker slot for the resolve of the in-flight PROCESS promise.
  private pendingResolvers: (((r: SimOutMsgDone) => void) | null)[] = []
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
  private coordinatorTransfers = makeTransferCoordinator()
  private readonly promises: Promise<SimOutMsgDone>[] = []
  private chunksWide = 0
  private readonly chunkMap = new Map<number, number[]>()
  private workerBatches: number[][] = []
  private writeQueue: {
    indices: number[]
    tile: number,
  }[] = []

  init(
    tilesBuffer: SharedArrayBuffer,
    dirtyChunksBuffer: SharedArrayBuffer,
    width: number,
    height: number,
    chunkSize: number,
    poolSize: number,
  ) {
    this.width = width
    this.chunkSize = chunkSize
    this.chunksWide = Math.ceil(width / chunkSize)
    this.workerBatches = Array.from({ length: poolSize }, () => [])

    // Coordinator's own MatterSim — used only for activate() and
    // reactivateAround() (tile reads/writes + set population). No step loop.
    this.sim = new MatterSim()
    this.sim.init(tilesBuffer, dirtyChunksBuffer, width, height, chunkSize)

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
    // startLoop() is called once all pool workers reply READY.
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

    // SPAWN_PARTICLE and any other matterType-action postMessage calls:
    // pool workers call postMessage() which reaches the coordinator;
    // forward straight to the main thread.
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

    // @TODO handle this.writeQueue
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