import type { ChunkGridBuffers } from '../../../Tilemap/ChunkGrid.ts'

// Values start at 100: MatterSim workers forward CoordinatorOutMessages on the same
// channel, so SimOutMsg values must not collide with CoordinatorOutMsg values (0+).
export enum SimInMsg {
  INIT = 100,
  PROCESS = 101,
}

export enum SimOutMsg {
  READY = 100,
  DONE = 101,
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
}

export type SimOutMessage =
  | SimOutMsgReady
  | SimOutMsgDone

export type TypedMatterSimWorker = Omit<Worker, 'postMessage' | 'onmessage'> & {
  postMessage(msg: SimInMessage): void
  onmessage: ((e: MessageEvent<SimOutMessage>) => void) | null
}
