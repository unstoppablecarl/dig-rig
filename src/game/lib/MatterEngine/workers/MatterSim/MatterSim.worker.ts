/// <reference lib="webworker" />
import { MatterSim } from './MatterSim.ts'
import { type SimInMessage, SimInMsg, type SimOutMessage, SimOutMsg, type SimOutMsgDone } from './MatterSim.types.ts'

declare function postMessage(msg: SimOutMessage, transfer?: Transferable[]): void

declare let self: DedicatedWorkerGlobalScope & {
  onmessage: ((e: MessageEvent<SimInMessage>) => void) | null
}

const sim = new MatterSim()

const _done: SimOutMsgDone = {
  type: SimOutMsg.DONE as const,
  next: [],
  vfxJustSettled: [],
  structuralRemovals: [],
  matterTankTransfers: new Int32Array(),
  matterReservationReleases: new Int32Array(),
}

const transfer: Transferable[] = []

self.onmessage = (e: MessageEvent<SimInMessage>) => {
  const msg = e.data

  if (msg.type === SimInMsg.INIT) {
    sim.init(msg.tilesBuffer, msg.fillBuffer, msg.chunkBuffers, msg.width, msg.height)
    postMessage({ type: SimOutMsg.READY })
    return
  }

  if (msg.type === SimInMsg.PROCESS) {
    transfer.length = 0
    const result = sim.process(msg.indices, msg.leftFirst, msg.frame, _done)
    if (result.matterTankTransfers.length > 0) transfer.push(result.matterTankTransfers.buffer)
    if (result.matterReservationReleases.length > 0) transfer.push(result.matterReservationReleases.buffer)
    postMessage(result, transfer)
  }
}
