import {
  SimInMsg,
  type SimInMsgInit,
  type SimInMsgProcess,
  SimOutMsg,
  type SimOutMessage,
  type SimOutMessageWire,
  type TypedMatterSimWorker,
} from './MatterSim.types.ts'
import MatterSimConstructor from './MatterSim.worker.ts?worker'
import { SIM_SCRATCH_CAPACITY, MatterSimScratchData } from './MatterSimScratchData.ts'

type ControllerConfig = Omit<SimInMsgInit, 'type' | 'scratchBuffers'>

export class MatterSimController {
  private readonly worker: TypedMatterSimWorker

  // Coordinator-side view onto the same shared buffers the worker writes
  // into — reading a result is just a subarray slice (no copy, no clone),
  // and writing a new batch of indices is a single .set() (no postMessage
  // structured-clone of a potentially many-thousand-entry array).
  private readonly scratch: MatterSimScratchData

  constructor(
    config: ControllerConfig,
    onMessage: (e: MessageEvent<SimOutMessage>) => void,
  ) {
    this.scratch = new MatterSimScratchData(MatterSimScratchData.makeBuffers())

    this.worker = new MatterSimConstructor()
    this.worker.postMessage({
      type: SimInMsg.INIT,
      ...config,
      scratchBuffers: this.scratch.buffers,
    })

    // Hydrate the wire message (counts only) into the shape callers expect
    // (Int32Array views, a drop-in replacement for the old number[] arrays —
    // for-of/.length work identically) before forwarding it on.
    this.worker.onmessage = (e: MessageEvent<SimOutMessageWire>) => {
      const msg = e.data
      if (msg.type === SimOutMsg.DONE) {
        onMessage({
          data: {
            type: SimOutMsg.DONE,
            next: this.scratch.next.subarray(0, msg.nextCount),
            vfxJustSettled: this.scratch.vfxJustSettled.subarray(0, msg.vfxJustSettledCount),
            structuralRemovals: this.scratch.structuralRemovals.subarray(0, msg.structuralRemovalsCount),
            matterTankTransfers: msg.matterTankTransfers,
            matterReservationReleases: msg.matterReservationReleases,
            liquidNetDelta: msg.liquidNetDelta,
            solidNetDelta: msg.solidNetDelta,
            busyMs: msg.busyMs,
          },
        } as MessageEvent<SimOutMessage>)
        return
      }
      onMessage(e as MessageEvent<SimOutMessage>)
    }
  }

  private _process: SimInMsgProcess = {
    type: SimInMsg.PROCESS as const,
    indicesCount: 0,
    leftFirst: false,
    frame: 0,
  }

  process(indices: number[], leftFirst: boolean, frame: number) {
    let count = indices.length
    if (count > SIM_SCRATCH_CAPACITY) {
      console.warn(`MatterSimController: indices batch (${count}) exceeds scratch capacity (${SIM_SCRATCH_CAPACITY}), truncating`)
      indices = indices.slice(0, SIM_SCRATCH_CAPACITY)
      count = SIM_SCRATCH_CAPACITY
    }
    this.scratch.indices.set(indices)

    this._process.indicesCount = count
    this._process.leftFirst = leftFirst
    this._process.frame = frame

    this.worker.postMessage(this._process)
  }

  terminate() {
    this.worker.terminate()
  }
}
