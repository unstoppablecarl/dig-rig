import { type MatterType } from '../../Matter/_Matter.types.ts'
import type { MatterTankId } from '../../Matter/Tank/_MatterTank.types.ts'
import {
  CoordinatorInMsg,
  type CoordinatorInMsgInit,
  type TypedMatterCoordinatorWorker,
} from './Coordinator.types.ts'
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

  terminate() {
    this.worker.terminate()
  }
}
