import { SimInMsg } from './_WorkerMessage.types.ts'
import type { CoordinatorOutMessage } from './MatterCoordinator.types.ts'
import {
  type SimInMsgInit,
  type SimInMsgProcess,
  type SimOutMessage,
  type TypedMatterSimWorker,
} from './MatterSim.types.ts'
import MatterSimConstructor from './MatterSim.worker.ts?worker'

export class MatterSimWorkerController {
  private readonly worker: TypedMatterSimWorker

  constructor(
    config: Omit<SimInMsgInit, 'type'>,
    onMessage: (e: MessageEvent<SimOutMessage | CoordinatorOutMessage>) => void,
  ) {
    this.worker = new MatterSimConstructor()
    this.worker.postMessage({
      type: SimInMsg.INIT,
      ...config,
    })

    this.worker.onmessage = onMessage
  }

  private _process: SimInMsgProcess = {
    type: SimInMsg.PROCESS as const,
    indices: [] as number[],
    leftFirst: false,
    frame: 0,
  }

  process(
    indices: SimInMsgProcess['indices'],
    leftFirst: SimInMsgProcess['leftFirst'],
    frame: SimInMsgProcess['frame'],
  ) {
    this._process.indices = indices
    this._process.leftFirst = leftFirst
    this._process.frame = frame

    this.worker.postMessage(this._process)
  }

  terminate() {
    this.worker.terminate()
  }
}