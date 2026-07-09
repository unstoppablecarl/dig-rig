/// <reference lib="webworker" />
import { Coordinator } from './Coordinator.ts'
import { type CoordinatorInMessage, CoordinatorInMsg } from './Coordinator.types.ts'

declare let self: DedicatedWorkerGlobalScope & {
  onmessage: ((e: MessageEvent<CoordinatorInMessage>) => void) | null
}

const poolSize = Math.max(1, (navigator.hardwareConcurrency ?? 4) - 2)
const coordinator = new Coordinator()

self.onmessage = (e: MessageEvent<CoordinatorInMessage>) => {
  const msg = e.data

  if (msg.type === CoordinatorInMsg.INIT) {
    coordinator.init(msg, poolSize)
    return
  }

  if (msg.type === CoordinatorInMsg.BRUSH_ERASE_MATTER) {
    coordinator.brushEraseMatter(msg)
    return
  }

  if (msg.type === CoordinatorInMsg.BRUSH_ADD_MATTER) {
    coordinator.brushAddMatter(msg.value, msg.tx, msg.ty, msg.radius)
    return
  }

  if (msg.type === CoordinatorInMsg.DESTROY) {
    coordinator.destroy()
    self.close()
  }
}
