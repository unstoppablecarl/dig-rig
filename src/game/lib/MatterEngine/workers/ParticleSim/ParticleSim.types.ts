import type { ParticleDataBuffers } from '../../data/ParticleData.ts'

export enum ParticleWorkerInMsg {
  INIT,
  SPAWN_BATCH,
}

export enum ParticleWorkerOutMsg {
  ACTIVATIONS,
}

type InitMessage = {
  type: ParticleWorkerInMsg.INIT
  tiles: SharedArrayBuffer
} & ParticleDataBuffers

// Packed as [particleType, x, y, ownerId, ...] with 4 ints per entry
type SpawnBatchMessage = {
  type: ParticleWorkerInMsg.SPAWN_BATCH
  data: Int32Array
}

export type ParticleWorkerInMessage =
  | InitMessage
  | SpawnBatchMessage

type ActivationsMessage = {
  type: ParticleWorkerOutMsg.ACTIVATIONS
  indices: number[]
}
export type ParticleWorkerOutMessage =
  | ActivationsMessage

export type TypedParticleWorker = Omit<Worker, 'postMessage' | 'onmessage'> & {
  postMessage(msg: ParticleWorkerInMessage, transfer?: Transferable[]): void
  onmessage: ((e: MessageEvent<ParticleWorkerOutMessage>) => void) | null
}
