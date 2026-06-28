import { type MatterType } from '../../Matter/_Matter.types.ts'
import type { MatterTankId } from '../../Matter/Tank/_MatterTank.types.ts'
import { ParticleType } from '../../Particles/_particle-types.ts'
import type { GetParticleInitArgs } from '../../Particles/particles.ts'
import { CoordinatorInMsg, type CoordinatorInMsgInit, type TypedMatterCoordinatorWorker } from './Coordinator.types.ts'
import CoordinatorWorkerConstructor from './Coordinator.worker.ts?worker'

export class CoordinatorController {
  private readonly worker: TypedMatterCoordinatorWorker

  constructor(config: Omit<CoordinatorInMsgInit, 'type'>) {
    this.worker = new CoordinatorWorkerConstructor()
    this.worker.postMessage({
      type: CoordinatorInMsg.INIT,
      ...config,
    })
  }

  brushEraseMatter(
    tx: number,
    ty: number,
    radius: number,
    ownerId: MatterTankId,
  ) {
    this.worker.postMessage({ type: CoordinatorInMsg.BRUSH_ERASE_MATTER, tx, ty, radius, ownerId })
  }

  brushAddMatter(
    value: MatterType,
    tx: number,
    ty: number,
    radius: number,
  ) {
    this.worker.postMessage({ type: CoordinatorInMsg.BRUSH_ADD_MATTER, value, tx, ty, radius })
  }

  spawnParticle<T extends ParticleType>(
    particleType: T,
    tx: number,
    ty: number,
    ownerId?: MatterTankId,
    ...initArgs: GetParticleInitArgs<T>
  ){
    this.worker.postMessage({ type: CoordinatorInMsg.SPAWN_PARTICLE, particleType, tx, ty, ownerId, initArgs: initArgs})
  }

  terminate() {
    this.worker.postMessage({ type: CoordinatorInMsg.DESTROY })
  }
}
