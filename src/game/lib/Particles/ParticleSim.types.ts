import type { MatterTankId } from '../Matter/MatterTank/_MatterTank.types.ts'
import type { ParticleType } from './_particle-types.ts'

export enum ParticleWorkerInMsg {
  INIT,
  SPAWN,
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
export type ParticleWorkerInMessage =
  | InitMessage
  | SpawnMessage

type ActivationsMessage = {
  type: ParticleWorkerOutMsg.ACTIVATIONS
  indices: number[]
}
export type ParticleWorkerOutMessage =
  | ActivationsMessage

export type TypedParticleWorker = Omit<Worker, 'postMessage' | 'onmessage'> & {
  postMessage(msg: ParticleWorkerInMessage): void
  onmessage: ((e: MessageEvent<ParticleWorkerOutMessage>) => void) | null
}
