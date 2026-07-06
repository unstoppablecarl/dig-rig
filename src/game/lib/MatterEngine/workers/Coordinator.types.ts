import { type MatterRaw } from '../../Matter/_Matter.types.ts'
import { type MatterTankId } from '../../Matter/Tank/_MatterTank.types.ts'
import { ParticleType } from '../../Particles/_particle-types.ts'
import type { DataManagerBuffers } from '../DataManager.ts'

export enum CoordinatorInMsg {
  INIT,
  BRUSH_ERASE_MATTER,
  BRUSH_ADD_MATTER,
  SPAWN_PARTICLE,
  DESTROY,
}

export type CoordinatorInMsgInit = {
  type: CoordinatorInMsg.INIT
} & DataManagerBuffers

export type CoordinatorInMsgBrushEraseMatter = {
  type: CoordinatorInMsg.BRUSH_ERASE_MATTER
  tx: number
  ty: number
  radius: number
  ownerId: MatterTankId
}

export type CoordinatorInMsgAddBrushMatter = {
  type: CoordinatorInMsg.BRUSH_ADD_MATTER
  value: MatterRaw
  tx: number
  ty: number
  radius: number
}

export type CoordinatorInMsgSpawnParticle = {
  type: CoordinatorInMsg.SPAWN_PARTICLE
  particleType: ParticleType
  tx: number
  ty: number
  ownerId?: MatterTankId
  initArgs?: unknown[]
}

export type CoordinatorInMsgDestroy = {
  type: CoordinatorInMsg.DESTROY
}

export type CoordinatorInMessage =
  | CoordinatorInMsgInit
  | CoordinatorInMsgAddBrushMatter
  | CoordinatorInMsgBrushEraseMatter
  | CoordinatorInMsgSpawnParticle
  | CoordinatorInMsgDestroy

export type TypedMatterCoordinatorWorker = Omit<Worker, 'postMessage'> & {
  postMessage(msg: CoordinatorInMessage): void
}
