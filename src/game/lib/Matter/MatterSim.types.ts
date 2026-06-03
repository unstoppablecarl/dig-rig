import type { ParticleType } from '../Particles/_particle-types.ts'

export enum MatterCoordinatorInMsg {
  INIT,
  ACTIVATE,
  CHECK,
}

export enum MatterCoordinatorOutMsg {
  SETTLED,
  SPAWN_PARTICLE,
}

type Init = {
  type: MatterCoordinatorInMsg.INIT
  tilesBuffer: SharedArrayBuffer
  dirtyChunksBuffer: SharedArrayBuffer
  width: number
  height: number
  chunkSize: number
}

type Activate = {
  type: MatterCoordinatorInMsg.ACTIVATE; indices: number[]
}

type Check = {
  type: MatterCoordinatorInMsg.CHECK
  tx: number
  ty: number
}

export type MatterCoordinatorInMessage =
  | Init
  | Activate
  | Check

type Settled = {
  type: MatterCoordinatorOutMsg.SETTLED
  indices: number[]
}

type SpawnParticle = {
  type: MatterCoordinatorOutMsg.SPAWN_PARTICLE
  particleType: ParticleType
  x: number
  y: number
}

export type WorkerOutMessage =
  | Settled
  | SpawnParticle

export type TypedMatterCoordinatorWorker = Omit<Worker, 'postMessage' | 'onmessage'> & {
  postMessage(msg: MatterCoordinatorInMessage): void
  onmessage: ((e: MessageEvent<WorkerOutMessage>) => void) | null
}
