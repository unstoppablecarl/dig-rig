/// <reference lib="webworker" />
import { SimInMsg, SimOutMsg } from './_WorkerMessage.types.ts'
import type { CoordinatorOutMessage } from './MatterCoordinator.types.ts'
import { MatterSim } from './MatterSim.ts'
import { type SimInMessage, type SimOutMessage, type SimOutMsgDone } from './MatterSim.types.ts'

declare function postMessage(msg: SimOutMessage | CoordinatorOutMessage, transfer?: Transferable[]): void

declare let self: DedicatedWorkerGlobalScope & {
  onmessage: ((e: MessageEvent<SimInMessage>) => void) | null
}

const sim = new MatterSim()

const _done: SimOutMsgDone = {
  type: SimOutMsg.DONE as const,
  next: [],
  settled: [],
  transfers: new Int32Array(),
}

self.onmessage = (e: MessageEvent<SimInMessage>) => {
  const msg = e.data

  if (msg.type === SimInMsg.INIT) {
    sim.init(msg.tilesBuffer, msg.dirtyChunksBuffer, msg.width, msg.height, msg.chunkSize)
    postMessage({ type: SimOutMsg.READY })
    return
  }

  if (msg.type === SimInMsg.PROCESS) {
    const result = sim.process(msg.indices, msg.leftFirst, msg.frame, _done)
    postMessage(
      result,
      result.transfers.length > 0 ? [result.transfers.buffer] : [],
    )
  }
}
