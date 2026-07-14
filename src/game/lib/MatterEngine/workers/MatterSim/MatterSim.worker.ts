/// <reference lib="webworker" />
import { MatterSim } from './MatterSim.ts'
import {
  type SimInMessage,
  SimInMsg,
  SimOutMsg,
  type SimOutMsgDoneWire,
  type SimOutMessageWire,
} from './MatterSim.types.ts'

declare function postMessage(msg: SimOutMessageWire, transfer?: Transferable[]): void

declare let self: DedicatedWorkerGlobalScope & {
  onmessage: ((e: MessageEvent<SimInMessage>) => void) | null
}

const sim = new MatterSim()

const _done: SimOutMsgDoneWire = {
  type: SimOutMsg.DONE as const,
  nextCount: 0,
  vfxJustSettledCount: 0,
  structuralRemovalsCount: 0,
  matterTankTransfers: new Int32Array(),
  matterReservationReleases: new Int32Array(),
  liquidNetDelta: 0,
  solidNetDelta: 0,
  busyMs: 0,
}

const transfer: Transferable[] = []

self.onmessage = (e: MessageEvent<SimInMessage>) => {
  const msg = e.data

  if (msg.type === SimInMsg.INIT) {
    sim.init(
      msg.tilesBuffer,
      msg.fillBuffer,
      msg.chunkBuffers,
      msg.width,
      msg.height,
      msg.scratchBuffers,
      msg.particleSpawnBuffer,
    )
    postMessage({ type: SimOutMsg.READY })
    return
  }

  if (msg.type === SimInMsg.PROCESS) {
    transfer.length = 0
    const result = sim.process(msg.indicesCount, msg.leftFirst, msg.frame, _done)
    if (result.matterTankTransfers.length > 0) transfer.push(result.matterTankTransfers.buffer)
    if (result.matterReservationReleases.length > 0) transfer.push(result.matterReservationReleases.buffer)
    postMessage(result, transfer)
  }
}
