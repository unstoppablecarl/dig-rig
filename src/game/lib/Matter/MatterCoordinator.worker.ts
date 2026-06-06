/// <reference lib="webworker" />
import { MatterCoordinator } from './MatterCoordinator.ts'
import { type MatterCoordinatorInMessage, MatterCoordinatorInMsg } from './MatterSim.types.ts'
import MatterSimWorkerConstructor from './MatterSim.worker.ts?worker'

declare let self: DedicatedWorkerGlobalScope & {
  onmessage: ((e: MessageEvent<MatterCoordinatorInMessage>) => void) | null
}

const poolSize = Math.max(1, (navigator.hardwareConcurrency ?? 4) - 2)
const poolWorkers: Worker[] = Array.from({ length: poolSize }, () => new MatterSimWorkerConstructor())

const coordinator = new MatterCoordinator(msg => postMessage(msg))

self.onmessage = (e: MessageEvent<MatterCoordinatorInMessage>) => {
  const msg = e.data

  if (msg.type === MatterCoordinatorInMsg.INIT) {
    coordinator.init(msg.tilesBuffer, msg.dirtyChunksBuffer, msg.width, msg.height, msg.chunkSize, poolWorkers)
    return
  }

  if (msg.type === MatterCoordinatorInMsg.ACTIVATE) {
    coordinator.activate(msg.indices)
    return
  }

  if (msg.type === MatterCoordinatorInMsg.CHECK) {
    coordinator.check(msg.tx, msg.ty)
  }
}
