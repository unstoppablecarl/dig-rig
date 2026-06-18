import type { ParticleType } from '../Particles/_particle-types.ts'
import type { MatterTankId } from './MatterTank/_MatterTank.types.ts'

export enum CoordinatorInMsg {
  INIT,
  ACTIVATE,
  CHECK,
  WRITE
}

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

export type CoordinatorInMessageCheck = {
  type: CoordinatorInMsg.CHECK
  tx: number
  ty: number
}

export type CoordinatorInMessageWrite = {
  type: CoordinatorInMsg.WRITE
  indices: number[]
  tile: number,
}

export type CoordinatorInMessage =
  | CoordinatorInMsgInit
  | CoordinatorInMsgActivate
  | CoordinatorInMessageCheck
  | CoordinatorInMessageWrite

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

export enum CoordinatorOutMsg {
  SETTLED,
  SPAWN_PARTICLE,
  TRANSFER_TO_MATTER_TANKS,
}

export type CoordinatorOutMessage =
  | CoordinatorOutMsgSettled
  | CoordinatorOutMsgSpawnParticle
  | CoordinatorOutMsgTransferToMatterTanks

export type TypedMatterCoordinatorWorker = Omit<Worker, 'postMessage' | 'onmessage'> & {
  postMessage(msg: CoordinatorInMessage): void
  onmessage: ((e: MessageEvent<CoordinatorOutMessage>) => void) | null
}