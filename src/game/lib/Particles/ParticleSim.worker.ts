/// <reference lib="webworker" />
import { ParticleSim } from './ParticleSim.ts'
import type { ParticleWorkerInMessage, ParticleWorkerOutMessage } from './ParticleSim.types.ts'
import { ParticleWorkerInMsg } from './ParticleSim.types.ts'
import type { MatterTankId } from '../Matter/MatterTank/_MatterTank.types.ts'
import type { ParticleType } from './_particle-types.ts'

declare function postMessage(msg: ParticleWorkerOutMessage): void

declare let self: DedicatedWorkerGlobalScope & {
  onmessage: ((e: MessageEvent<ParticleWorkerInMessage>) => void) | null
}

const world = new ParticleSim()

self.onmessage = (e: MessageEvent<ParticleWorkerInMessage>) => {
  const msg = e.data

  if (msg.type === ParticleWorkerInMsg.INIT) {
    world.init(
      new Uint32Array(msg.tilesSab),
      msg.pixelSab,
      msg.dirtySab,
      msg.width,
      msg.height,
    )
    return
  }

  if (msg.type === ParticleWorkerInMsg.SPAWN) {
    world.spawn(msg.particleType, msg.x, msg.y, msg.ownerId)
    return
  }

  if (msg.type === ParticleWorkerInMsg.SPAWN_BATCH) {
    const { data } = msg
    for (let i = 0; i < data.length; i += 4) {
      world.spawn(data[i] as ParticleType, data[i + 1], data[i + 2], data[i + 3] as MatterTankId)
    }
  }
}
