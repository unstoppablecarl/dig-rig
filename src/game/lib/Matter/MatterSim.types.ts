// String enums avoid numeric collision with MatterWorkerOutMsg values.

export enum SimInMsg {
  INIT = 'pool.init',
  PROCESS = 'pool.process',
}

export enum SimOutMsg {
  READY = 'pool.ready',
  DONE = 'pool.done',
}

export type SimInMsgInit = {
  type: SimInMsg.INIT
  tilesBuffer: SharedArrayBuffer
  dirtyChunksBuffer: SharedArrayBuffer
  width: number
  height: number
  chunkSize: number
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
  settled: number[]
  transfers: Int32Array
}

export type SimOutMessage =
  | SimOutMsgReady
  | SimOutMsgDone

export type TypedMatterSimWorker = Omit<Worker, 'postMessage' | 'onmessage'> & {
  postMessage(msg: SimInMessage): void
  onmessage: ((e: MessageEvent<SimOutMessage>) => void) | null
}