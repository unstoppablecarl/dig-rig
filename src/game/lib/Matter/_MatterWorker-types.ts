export enum MatterWorkerInMsg {
  INIT,
  ACTIVATE,
  CHECK,
}

export enum MatterWorkerOutMsg {
  SETTLED
}

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

export type TypedMatterWorker = Omit<Worker, 'postMessage' | 'onmessage'> & {
  postMessage(msg: WorkerInMessage): void
  onmessage: ((e: MessageEvent<WorkerOutMessage>) => void) | null
}
