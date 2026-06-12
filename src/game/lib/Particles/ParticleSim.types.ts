import type { MatterTankId } from '../Matter/MatterTank/_MatterTank.types.ts'
import type { ParticleType } from './_particle-types.ts'

export enum ParticleWorkerInMsg {
  INIT,
  SPAWN,
  SPAWN_BATCH,
}

export enum ParticleWorkerOutMsg {
  ACTIVATIONS,
}

type InitMessage = {
  type: ParticleWorkerInMsg.INIT
  tilesSab: SharedArrayBuffer
  pixelSab: SharedArrayBuffer
  // boolean state
  dirtySab: SharedArrayBuffer
  width: number
  height: number
}
type SpawnMessage = {
  type: ParticleWorkerInMsg.SPAWN
  particleType: ParticleType
  x: number
  y: number
  ownerId: MatterTankId
}
// Packed as [particleType, x, y, ownerId, ...] with 4 ints per entry
type SpawnBatchMessage = {
  type: ParticleWorkerInMsg.SPAWN_BATCH
  data: Int32Array
}

export type ParticleWorkerInMessage =
  | InitMessage
  | SpawnMessage
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
