import type { ChunkGridBuffers } from '../../../Tilemap/ChunkGrid.ts'
import type { MatterTankId } from '../../../Matter/Tank/_MatterTank.types.ts'
import type { ParticleType } from '../../../Particles/_particle-types.ts'

export enum SimInMsg {
  INIT = 100,
  PROCESS = 101,
}

export enum SimOutMsg {
  READY = 100,
  DONE = 101,
  SPAWN_PARTICLE = 102,
}

export type SimInMsgInit = {
  type: SimInMsg.INIT
  tilesBuffer: SharedArrayBuffer
  chunkBuffers: ChunkGridBuffers
  width: number
  height: number
}

export type SimInMsgProcess = {
  type: SimInMsg.PROCESS
  indices: number[]
  leftFirst: boolean
  frame: number
}

export type SimInMessage =
  | SimInMsgInit
  | SimInMsgProcess

export type SimOutMsgReady = {
  type: SimOutMsg.READY
}

export type SimOutMsgDone = {
  type: SimOutMsg.DONE
  next: number[]
  vfxJustSettled: number[]
  matterTankTransfers: Int32Array
  structuralRemovals: number[]
}

export type SimOutMsgSpawnParticle = {
  type: SimOutMsg.SPAWN_PARTICLE
  particleType: ParticleType
  x: number
  y: number
  ownerId?: MatterTankId
}

export type SimOutMessage =
  | SimOutMsgReady
  | SimOutMsgDone
  | SimOutMsgSpawnParticle

export type TypedMatterSimWorker = Omit<Worker, 'postMessage' | 'onmessage'> & {
  postMessage(msg: SimInMessage): void
  onmessage: ((e: MessageEvent<SimOutMessage>) => void) | null
}
