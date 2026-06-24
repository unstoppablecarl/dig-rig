/// <reference lib="webworker" />
import { ParticleSim } from './ParticleSim.ts'
import type { ParticleSimInMessage, ParticleSimOutMessage } from './ParticleSim.types.ts'
import { ParticleSimInMsg } from './ParticleSim.types.ts'

declare function postMessage(msg: ParticleSimOutMessage): void

declare let self: DedicatedWorkerGlobalScope & {
  onmessage: ((e: MessageEvent<ParticleSimInMessage>) => void) | null
}

const sim = new ParticleSim()

self.onmessage = (e: MessageEvent<ParticleSimInMessage>) => {
  const msg = e.data

  if (msg.type === ParticleSimInMsg.INIT) {
    sim.init(msg)
    return
  }

  if (msg.type === ParticleSimInMsg.SPAWN_BATCH) {
    sim.spawnBatch(msg.data)
  }
}
