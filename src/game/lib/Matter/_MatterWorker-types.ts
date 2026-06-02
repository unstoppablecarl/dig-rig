export enum MatterWorkerInMsg {
  INIT,
  ACTIVATE,
  CHECK,
}

export enum MatterWorkerOutMsg {
  SETTLED,
  SPAWN_PARTICLE,
}

export type ParticleTypeName =
  | 'gunpowder_explosion'
  | 'nitro_explosion'
  | 'napalm_explosion'
  | 'c4_explosion'
  | 'methane_explosion'
  | 'charged_nitro'
  | 'lava_burst'

export type WorkerInMessage =
  | {
  type: MatterWorkerInMsg.INIT;
  tilesBuffer: SharedArrayBuffer;
  dirtyChunksBuffer: SharedArrayBuffer;
  width: number;
  height: number;
  chunkSize: number
}
  | { type: MatterWorkerInMsg.ACTIVATE; indices: number[] }
  | { type: MatterWorkerInMsg.CHECK, tx: number; ty: number }

export type WorkerOutMessage =
  | { type: MatterWorkerOutMsg.SETTLED; indices: number[] }
  | { type: MatterWorkerOutMsg.SPAWN_PARTICLE; particleType: ParticleTypeName; x: number; y: number }

export type TypedMatterWorker = Omit<Worker, 'postMessage' | 'onmessage'> & {
  postMessage(msg: WorkerInMessage): void
  onmessage: ((e: MessageEvent<WorkerOutMessage>) => void) | null
}
