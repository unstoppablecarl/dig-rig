import type { ParticleType } from '../Particles/_particle-types.ts'
import type { FireMode } from '../Player/_FireMode-types.ts'
import type { ProjectileEffectResult } from '../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import type { MatterType } from './_Matter.types.ts'
import { CoordinatorInMsg, CoordinatorOutMsg } from './_WorkerMessage.types.ts'
import type { MatterTankId } from './MatterTank/_MatterTank.types.ts'

export type CoordinatorInMsgInit = {
  type: CoordinatorInMsg.INIT
  tilesBuffer: SharedArrayBuffer
  dirtyChunksBuffer: SharedArrayBuffer
  width: number
  height: number
  chunkSize: number
}

export type CoordinatorInMsgActivate = {
  type: CoordinatorInMsg.ACTIVATE
  indices: number[]
}

export type CoordinatorInMsgCheck = {
  type: CoordinatorInMsg.CHECK
  tx: number
  ty: number
}

export type CoordinatorInMsgWrite = {
  type: CoordinatorInMsg.WRITE
  indices: number[]
  tile: number,
  reactivateAround: boolean,
}

export type CoordinatorInMsgApplyEffect = {
  type: CoordinatorInMsg.APPLY_EFFECT
  requestId: number
  mode: FireMode
  createType: MatterType
  tileX: number
  tileY: number
  tileRadius: number
  innerRadius: number
  ownerId: MatterTankId
  tilesToModify: number
  playerBoundsLeft: number
  playerBoundsRight: number
  playerBoundsTop: number
  playerBoundsBottom: number
}

export type PlayerPreventCreateBounds = Pick<
  CoordinatorInMsgApplyEffect,
  | 'playerBoundsTop'
  | 'playerBoundsBottom'
  | 'playerBoundsLeft'
  | 'playerBoundsRight'
>

export type CoordinatorInMessage =
  | CoordinatorInMsgInit
  | CoordinatorInMsgActivate
  | CoordinatorInMsgCheck
  | CoordinatorInMsgWrite
  | CoordinatorInMsgApplyEffect

export type CoordinatorOutMsgSettled = {
  type: CoordinatorOutMsg.SETTLED
  indices: number[]
}

export type CoordinatorOutMsgSpawnParticle = {
  type: CoordinatorOutMsg.SPAWN_PARTICLE
  particleType: ParticleType
  x: number
  y: number
  ownerId?: MatterTankId
}

export type CoordinatorOutMsgTransferToMatterTanks = {
  type: CoordinatorOutMsg.TRANSFER_TO_MATTER_TANKS,
  transfers: Int32Array
}

export type CoordinatorOutMsgApplyEffectResult = {
  type: CoordinatorOutMsg.APPLY_EFFECT_RESULT
  requestId: number
  mode: FireMode
  tilesModified: number
  tiles: ProjectileEffectResult[]
}

export type CoordinatorOutMessage =
  | CoordinatorOutMsgSettled
  | CoordinatorOutMsgSpawnParticle
  | CoordinatorOutMsgTransferToMatterTanks
  | CoordinatorOutMsgApplyEffectResult

export type TypedMatterCoordinatorWorker = Omit<Worker, 'postMessage' | 'onmessage'> & {
  postMessage(msg: CoordinatorInMessage): void
  onmessage: ((e: MessageEvent<CoordinatorOutMessage>) => void) | null
}