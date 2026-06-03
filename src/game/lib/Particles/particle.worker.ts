/// <reference lib="webworker" />
import type { ParticleWorkerInMessage, ParticleWorkerOutMessage } from './_ParticleWorker-types.ts'
import { ParticleWorkerInMsg } from './_ParticleWorker-types.ts'
import { ParticleWorker } from './ParticleWorker.ts'

declare function postMessage(msg: ParticleWorkerOutMessage): void

declare let self: DedicatedWorkerGlobalScope & {
  onmessage: ((e: MessageEvent<ParticleWorkerInMessage>) => void) | null
}

const world = new ParticleWorker()

self.onmessage = (e: MessageEvent<ParticleWorkerInMessage>) => {
  const msg = e.data

  if (msg.type === ParticleWorkerInMsg.INIT) {
    world.init(
      new Uint32Array(msg.tilesSab),
      msg.pixelSab,
      msg.width,
      msg.height,
    )
    return
  }

  if (msg.type === ParticleWorkerInMsg.SPAWN) {
    world.spawn(msg.particleType, msg.x, msg.y)
  }
}
