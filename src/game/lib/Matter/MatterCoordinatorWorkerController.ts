import { CoordinatorInMsg, CoordinatorOutMsg } from './_WorkerMessage.types.ts'
import {
  type CoordinatorInMessageApplyEffect,
  type CoordinatorInMessageCheck,
  type CoordinatorInMessageWrite,
  type CoordinatorInMsgActivate,
  type CoordinatorInMsgInit,
  type CoordinatorOutMsgApplyEffectResult,
  type CoordinatorOutMsgSettled,
  type CoordinatorOutMsgSpawnParticle,
  type CoordinatorOutMsgTransferToMatterTanks,
  type TypedMatterCoordinatorWorker,
} from './MatterCoordinator.types.ts'
import MatterCoordinatorConstructor from './MatterCoordinator.worker.ts?worker'

export class MatterCoordinatorWorkerController {
  private readonly worker: TypedMatterCoordinatorWorker

  constructor(
    config: Omit<CoordinatorInMsgInit, 'type'>,
    responders: {
      settled: (indices: CoordinatorOutMsgSettled['indices']) => void,
      spawnParticle: (
        particleType: CoordinatorOutMsgSpawnParticle['particleType'],
        x: CoordinatorOutMsgSpawnParticle['x'],
        y: CoordinatorOutMsgSpawnParticle['y'],
        ownerId?: CoordinatorOutMsgSpawnParticle['ownerId'],
      ) => void,
      transferToMatterTanks: (
        transfers: CoordinatorOutMsgTransferToMatterTanks['transfers'],
      ) => void,
      applyEffectResult: (result: CoordinatorOutMsgApplyEffectResult) => void,
    },
  ) {
    this.worker = new MatterCoordinatorConstructor()
    this.worker.postMessage({
      type: CoordinatorInMsg.INIT,
      ...config,
    })

    this.worker.onmessage = (e) => {
      const d = e.data
      if (d.type === CoordinatorOutMsg.SETTLED) {
        responders.settled(d.indices)
      } else if (d.type === CoordinatorOutMsg.SPAWN_PARTICLE) {
        responders.spawnParticle(d.particleType, d.x, d.y, d.ownerId)
      } else if (d.type === CoordinatorOutMsg.TRANSFER_TO_MATTER_TANKS) {
        responders.transferToMatterTanks(d.transfers)
      } else if (d.type === CoordinatorOutMsg.APPLY_EFFECT_RESULT) {
        responders.applyEffectResult(d)
      }
    }
  }

  private _activate: CoordinatorInMsgActivate = {
    type: CoordinatorInMsg.ACTIVATE as const,
    indices: [] as number[],
  }

  activate(indices: CoordinatorInMsgActivate['indices']) {
    this._activate.indices = indices
    this.worker.postMessage(this._activate)
  }

  private _check: CoordinatorInMessageCheck = {
    type: CoordinatorInMsg.CHECK as const,
    tx: 0,
    ty: 0,
  }

  check(tx: CoordinatorInMessageCheck['tx'], ty: CoordinatorInMessageCheck['ty']) {
    this._check.tx = tx
    this._check.ty = ty
    this.worker.postMessage(this._check)
  }

  private _write: CoordinatorInMessageWrite = {
    type: CoordinatorInMsg.WRITE as const,
    indices: [],
    tile: 0,
  }

  write(indices: CoordinatorInMessageWrite['indices'], tile: CoordinatorInMessageWrite['tile']) {
    this._write.indices = indices
    this._write.tile = tile
    this.worker.postMessage(this._write)
  }

  applyEffect(req: Omit<CoordinatorInMessageApplyEffect, 'type'>) {
    this.worker.postMessage({ type: CoordinatorInMsg.APPLY_EFFECT, ...req })
  }

  terminate() {
    this.worker.terminate()
  }
}