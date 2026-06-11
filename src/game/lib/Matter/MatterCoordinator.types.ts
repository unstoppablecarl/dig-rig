// String enums avoid numeric collision with MatterWorkerOutMsg values.
export enum PoolInMsg {
  INIT = 'pool.init',
  PROCESS = 'pool.process',
}

export enum PoolOutMsg {
  READY = 'pool.ready',
  DONE = 'pool.done',
}

type PoolInInit = {
  type: PoolInMsg.INIT
  tilesBuffer: SharedArrayBuffer
  dirtyChunksBuffer: SharedArrayBuffer
  width: number
  height: number
  chunkSize: number
}

type PoolInProcess = {
  type: PoolInMsg.PROCESS
  indices: number[]
  leftFirst: boolean
  frame: number
}

export type PoolInMessage =
  | PoolInInit
  | PoolInProcess

type PoolOutReady = {
  type: PoolOutMsg.READY
}

export type PoolOutDone = {
  type: PoolOutMsg.DONE
  next: number[]
  settled: number[]
  transfers: Int32Array
}

export type PoolOutMessage =
  | PoolOutReady
  | PoolOutDone
