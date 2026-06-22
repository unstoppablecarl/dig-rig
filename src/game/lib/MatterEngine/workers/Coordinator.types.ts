import { type MatterType } from '../../Matter/_Matter.types.ts'
import type { MatterTankId } from '../../Matter/Tank/_MatterTank.types.ts'
import type { ParticleType } from '../../Particles/_particle-types.ts'
import type { DataManagerBuffers } from '../DataManager.ts'

export enum CoordinatorInMsg {
  INIT,
  BRUSH_ERASE_MATTER,
  BRUSH_ADD_MATTER,
  ACTIVATE_TILES,
}

export enum CoordinatorOutMsg {
  SPAWN_PARTICLE,
}

export type CoordinatorInMsgInit = {
  type: CoordinatorInMsg.INIT
} & DataManagerBuffers

export type CoordinatorInMsgBrushEraseMatter = {
  type: CoordinatorInMsg.BRUSH_ERASE_MATTER
  tileX: number
  tileY: number
  tileRadius: number
  ownerId: MatterTankId
}

export type CoordinatorInMsgAddBrushMatter = {
  type: CoordinatorInMsg.BRUSH_ADD_MATTER
  value: MatterType
  tx: number
  ty: number
  radius: number
}

export type CoordinatorInMsgActivateTiles = {
  type: CoordinatorInMsg.ACTIVATE_TILES
  indices: number[]
}

export type CoordinatorInMessage =
  | CoordinatorInMsgInit
  | CoordinatorInMsgAddBrushMatter
  | CoordinatorInMsgBrushEraseMatter
  | CoordinatorInMsgActivateTiles

export type CoordinatorOutMsgSpawnParticle = {
  type: CoordinatorOutMsg.SPAWN_PARTICLE
  particleType: ParticleType
  x: number
  y: number
  ownerId?: MatterTankId
}

export type CoordinatorOutMessage =
  | CoordinatorOutMsgSpawnParticle

export type TypedMatterCoordinatorWorker = Omit<Worker, 'postMessage' | 'onmessage'> & {
  postMessage(msg: CoordinatorInMessage): void
  onmessage: ((e: MessageEvent<CoordinatorOutMessage>) => void) | null
}
