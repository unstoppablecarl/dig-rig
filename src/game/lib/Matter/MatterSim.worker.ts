/// <reference lib="webworker" />
import { type PoolInMessage, PoolInMsg, type PoolOutMessage, PoolOutMsg } from './MatterCoordinator.types.ts'
import { MatterSim } from './MatterSim.ts'
import type { WorkerOutMessage } from './MatterSim.types.ts'
import './_Matter.glob.ts'

declare function postMessage(msg: PoolOutMessage | WorkerOutMessage, transfer?: Transferable[]): void

declare let self: DedicatedWorkerGlobalScope & {
  onmessage: ((e: MessageEvent<PoolInMessage>) => void) | null
}

const sim = new MatterSim()

self.onmessage = (e: MessageEvent<PoolInMessage>) => {
  const msg = e.data

  if (msg.type === PoolInMsg.INIT) {
    sim.init(msg.tilesBuffer, msg.dirtyChunksBuffer, msg.width, msg.height, msg.chunkSize)
    postMessage({ type: PoolOutMsg.READY })
    return
  }

  if (msg.type === PoolInMsg.PROCESS) {
    sim.next.clear()
    sim.frame = msg.frame
    sim.leftFirst = msg.leftFirst
    sim.justSettled = []
    sim.processSubset(msg.indices)
    const transfers = sim.flushTransferToMatterTank()
    postMessage(
      { type: PoolOutMsg.DONE, next: Array.from(sim.next), settled: sim.justSettled, transfers },
      transfers.length > 0 ? [transfers.buffer] : [],
    )
  }
}
