/// <reference lib="webworker" />
import type { CoordinatorOutMessage } from '../Coordinator.types.ts'
import { MatterSim } from './MatterSim.ts'
import { type SimInMessage, SimInMsg, type SimOutMessage, SimOutMsg, type SimOutMsgDone } from './MatterSim.types.ts'

declare function postMessage(msg: SimOutMessage | CoordinatorOutMessage, transfer?: Transferable[]): void

declare let self: DedicatedWorkerGlobalScope & {
  onmessage: ((e: MessageEvent<SimInMessage>) => void) | null
}

const sim = new MatterSim()

const _done: SimOutMsgDone = {
  type: SimOutMsg.DONE as const,
  next: [],
  vfxJustSettled: [],
  matterTankTransfers: new Int32Array(),
}

self.onmessage = (e: MessageEvent<SimInMessage>) => {
  const msg = e.data

  if (msg.type === SimInMsg.INIT) {
    sim.init(msg.tilesBuffer, msg.chunkBuffers, msg.width, msg.height)
    postMessage({ type: SimOutMsg.READY })
    return
  }

  if (msg.type === SimInMsg.PROCESS) {
    const result = sim.process(msg.indices, msg.leftFirst, msg.frame, _done)
    postMessage(
      result,
      result.matterTankTransfers.length > 0 ? [result.matterTankTransfers.buffer] : [],
    )
  }
}
