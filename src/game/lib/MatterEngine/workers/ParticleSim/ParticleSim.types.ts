import type { ParticleBuffers } from '../../data/ParticleData.ts'

export enum ParticleSimInMsg {
  INIT,
  SPAWN_BATCH,
}

export enum ParticleSimOutMsg {
  ACTIVATIONS,
}

export type ParticleSimInMsgInit = {
  type: ParticleSimInMsg.INIT
  tiles: SharedArrayBuffer,
  particleBuffers: ParticleBuffers
}

export type ParticleSimInMsgSpawnBatch = {
  type: ParticleSimInMsg.SPAWN_BATCH
  // Packed as [particleType, x, y, ownerId, ...] with 4 ints per entry
  data: Int32Array
}

export type ParticleSimInMessage =
  | ParticleSimInMsgInit
  | ParticleSimInMsgSpawnBatch

type ActivationsMessage = {
  type: ParticleSimOutMsg.ACTIVATIONS
  indices: number[]
}
export type ParticleSimOutMessage =
  | ActivationsMessage

export type TypedParticleWorker = Omit<Worker, 'postMessage' | 'onmessage'> & {
  postMessage(msg: ParticleSimInMessage, transfer?: Transferable[]): void
  onmessage: ((e: MessageEvent<ParticleSimOutMessage>) => void) | null
}
