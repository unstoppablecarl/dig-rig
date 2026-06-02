/// <reference lib="webworker" />
import { MatterWorld } from './MatterWorld'
import { MatterWorkerInMsg, type WorkerInMessage, type WorkerOutMessage } from './_MatterWorker-types.ts'

declare function postMessage(msg: WorkerOutMessage): void

declare let self: DedicatedWorkerGlobalScope & {
  onmessage: ((e: MessageEvent<WorkerInMessage>) => void) | null
}

const world = new MatterWorld()

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data

  if (msg.type === MatterWorkerInMsg.INIT) {
    world.init(msg.tilesBuffer, msg.dirtyChunksBuffer, msg.width, msg.height, msg.chunkSize)
    return
  }

  if (msg.type === MatterWorkerInMsg.ACTIVATE) {
    world.activate(msg.indices)
    return
  }

  if (msg.type === MatterWorkerInMsg.CHECK) {
    world.check(msg.tx, msg.ty)
  }
}
