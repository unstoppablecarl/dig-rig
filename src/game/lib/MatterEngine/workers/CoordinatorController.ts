import {
  CoordinatorInMsg,
  type CoordinatorInMsgActivateTiles,
  type CoordinatorInMsgAddBrushMatter,
  type CoordinatorInMsgBrushEraseMatter,
  type CoordinatorInMsgInit,
  CoordinatorOutMsg,
  type CoordinatorOutMsgSpawnParticle,
  type TypedMatterCoordinatorWorker,
} from './Coordinator.types.ts'
import CoordinatorWorkerConstructor from './Coordinator.worker.ts?worker'

export class CoordinatorController {
  private readonly worker: TypedMatterCoordinatorWorker

  constructor(
    config: Omit<CoordinatorInMsgInit, 'type'>,
    responders: {
      spawnParticle: (
        particleType: CoordinatorOutMsgSpawnParticle['particleType'],
        x: CoordinatorOutMsgSpawnParticle['x'],
        y: CoordinatorOutMsgSpawnParticle['y'],
        ownerId?: CoordinatorOutMsgSpawnParticle['ownerId'],
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

  brushEraseMatter(req: Omit<CoordinatorInMsgBrushEraseMatter, 'type'>) {
    this.worker.postMessage({ type: CoordinatorInMsg.BRUSH_ERASE_MATTER, ...req })
  }

  brushAddMatter(
    value: CoordinatorInMsgAddBrushMatter['value'],
    tx: CoordinatorInMsgAddBrushMatter['tx'],
    ty: CoordinatorInMsgAddBrushMatter['ty'],
    radius: CoordinatorInMsgAddBrushMatter['radius'],
  ) {
    this.worker.postMessage({ type: CoordinatorInMsg.BRUSH_ADD_MATTER, value, tx, ty, radius })
  }

  activateTiles(indices: CoordinatorInMsgActivateTiles['indices']) {
    this.worker.postMessage({ type: CoordinatorInMsg.ACTIVATE_TILES, indices })
  }

  terminate() {
    this.worker.terminate()
  }
}
