import type { ParticleType } from './_particle-types.ts'

export enum ParticleWorkerInMsg {
  INIT,
  SPAWN,
}

export enum ParticleWorkerOutMsg {
  ACTIVATIONS,
}

export type ParticleWorkerInMessage =
  | {
    type: ParticleWorkerInMsg.INIT
    tilesSab: SharedArrayBuffer
    pixelSab: SharedArrayBuffer
    width: number
    height: number
  }
  | { type: ParticleWorkerInMsg.SPAWN; particleType: ParticleType; x: number; y: number }

export type ParticleWorkerOutMessage =
  | { type: ParticleWorkerOutMsg.ACTIVATIONS; indices: number[] }

export type TypedParticleWorker = Omit<Worker, 'postMessage' | 'onmessage'> & {
  postMessage(msg: ParticleWorkerInMessage): void
  onmessage: ((e: MessageEvent<ParticleWorkerOutMessage>) => void) | null
}
