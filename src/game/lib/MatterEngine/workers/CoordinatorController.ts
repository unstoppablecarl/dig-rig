import type { MatterType } from '../../Matter/_Matter.types.ts'
import type { MatterTankId } from '../../Matter/Tank/_MatterTank.types.ts'
import type { ParticleType } from '../../Particles/_particle-types.ts'
import {
  CoordinatorInMsg,
  type CoordinatorInMsgInit,
  CoordinatorOutMsg,
  type TypedMatterCoordinatorWorker,
} from './Coordinator.types.ts'
import CoordinatorWorkerConstructor from './Coordinator.worker.ts?worker'

export class CoordinatorController {
  private readonly worker: TypedMatterCoordinatorWorker

  constructor(
    config: Omit<CoordinatorInMsgInit, 'type'>,
    responders: {
      spawnParticle: (
        particleType: ParticleType,
        x: number,
        y: number,
        ownerId?: MatterTankId,
      ) => void,
    },
  ) {
    this.worker = new CoordinatorWorkerConstructor()
    this.worker.postMessage({
      type: CoordinatorInMsg.INIT,
      ...config,
    })

    this.worker.onmessage = (e) => {
      const d = e.data
      if (d.type === CoordinatorOutMsg.SPAWN_PARTICLE) {
        responders.spawnParticle(d.particleType, d.x, d.y, d.ownerId)
      }
    }
  }

  brushEraseMatter(
    tileX: number,
    tileY: number,
    tileRadius: number,
    ownerId: MatterTankId,
  ) {
    this.worker.postMessage({ type: CoordinatorInMsg.BRUSH_ERASE_MATTER, tileX, tileY, tileRadius, ownerId })
  }

  brushAddMatter(
    value: MatterType,
    tx: number,
    ty: number,
    radius: number,
  ) {
    this.worker.postMessage({ type: CoordinatorInMsg.BRUSH_ADD_MATTER, value, tx, ty, radius })
  }

  activateTiles(indices: number[]) {
    this.worker.postMessage({ type: CoordinatorInMsg.ACTIVATE_TILES, indices })
  }

  terminate() {
    this.worker.terminate()
  }
}
