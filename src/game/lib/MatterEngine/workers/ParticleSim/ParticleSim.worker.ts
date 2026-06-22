/// <reference lib="webworker" />
import { ParticleSim } from './ParticleSim.ts'
import type { ParticleWorkerInMessage, ParticleWorkerOutMessage } from './ParticleSim.types.ts'
import { ParticleWorkerInMsg } from './ParticleSim.types.ts'
import { ParticleSpawnBuffer } from './ParticleSpawnBuffer.ts'

declare function postMessage(msg: ParticleWorkerOutMessage): void

declare let self: DedicatedWorkerGlobalScope & {
  onmessage: ((e: MessageEvent<ParticleWorkerInMessage>) => void) | null
}

const sim = new ParticleSim()

self.onmessage = (e: MessageEvent<ParticleWorkerInMessage>) => {
  const msg = e.data

  if (msg.type === ParticleWorkerInMsg.INIT) {
    sim.init(
      new Uint32Array(msg.tiles),
      msg,
    )
    return
  }

  if (msg.type === ParticleWorkerInMsg.SPAWN_BATCH) {
    const { data } = msg
    ParticleSpawnBuffer.readBuffer(data, (type, x, y, ownerId) => {
      sim.spawn(type, x, y, ownerId)
    })
  }
}
