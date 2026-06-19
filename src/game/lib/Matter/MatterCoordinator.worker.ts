/// <reference lib="webworker" />
import { MatterCoordinator } from './MatterCoordinator.ts'
import { type CoordinatorInMessage, CoordinatorInMsg } from './MatterCoordinator.types.ts'

declare let self: DedicatedWorkerGlobalScope & {
  onmessage: ((e: MessageEvent<CoordinatorInMessage>) => void) | null
}

const poolSize = Math.max(1, (navigator.hardwareConcurrency ?? 4) - 2)
const coordinator = new MatterCoordinator((msg, transfer) => postMessage(msg, transfer ?? []))

self.onmessage = (e: MessageEvent<CoordinatorInMessage>) => {
  const msg = e.data

  if (msg.type === CoordinatorInMsg.INIT) {
    coordinator.init(msg.tilesBuffer, msg.dirtyChunksBuffer, msg.width, msg.height, msg.chunkSize, poolSize)
    return
  }

  if (msg.type === CoordinatorInMsg.ACTIVATE) {
    coordinator.activate(msg.indices)
    return
  }

  if (msg.type === CoordinatorInMsg.CHECK) {
    coordinator.check(msg.tx, msg.ty)
    return
  }

  if (msg.type === CoordinatorInMsg.WRITE) {
    coordinator.write(msg.indices, msg.tile)
    return
  }

  if (msg.type === CoordinatorInMsg.APPLY_EFFECT) {
    coordinator.applyEffect(msg)
  }
}
