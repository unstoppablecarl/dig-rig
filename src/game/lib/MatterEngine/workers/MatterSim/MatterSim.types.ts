import type { ChunkGridBuffers } from '../../../Tilemap/ChunkGrid.ts'
import type { SimScratchBuffers } from './MatterSimScratchData.ts'

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
  fillBuffer: SharedArrayBuffer
  // Per-tile frame stamp shared across every worker in the pool — lets
  // processSubset detect and skip an index whose occupant already had its one
  // update this tick via a move written by an earlier round (same tick, only
  // rounds are sequential/awaited so no atomics needed). See MatterSim.touched.
  touchedBuffer: SharedArrayBuffer
  chunkBuffers: ChunkGridBuffers
  width: number
  height: number
  // Shared scratch buffers (see SimScratchData) — avoids structured-cloning
  // the indices/next/vfx/structural arrays over postMessage every round.
  // Coordinator side writes indices in / reads results out via views on
  // these same buffers instead of array payloads.
  scratchBuffers: SimScratchBuffers
  particleSpawnBuffer: SharedArrayBuffer
  // Shared across every worker in the pool and Coordinator — see
  // MatterSim.lavaColumnTop's own comment for the self-report mechanics.
  lavaColumnTopBuffer: SharedArrayBuffer
  // Player world-space AABB, written every render frame by Player.ts —
  // see MatterSim.playerBounds for why powder settling reads it.
  playerBoundsBuffer: SharedArrayBuffer
}

export type SimInMsgProcess = {
  type: SimInMsg.PROCESS
  indicesCount: number
  leftFirst: boolean
  frame: number
}

export type SimInMessage =
  | SimInMsgInit
  | SimInMsgProcess

export type SimOutMsgReady = {
  type: SimOutMsg.READY
}

// What actually goes over the wire from worker -> controller: counts only,
// so postMessage has a tiny fixed-size payload instead of cloning
// potentially thousands of entries. matterTankTransfers/matterReservationReleases
// stay as transferable Int32Arrays (already zero-clone via the transfer list).
export type SimOutMsgDoneWire = {
  type: SimOutMsg.DONE
  nextCount: number
  vfxJustSettledCount: number
  structuralRemovalsCount: number
  matterTankTransfers: Int32Array
  matterReservationReleases: Int32Array
  liquidNetDelta: number
  solidNetDelta: number
  // Wall-clock time (ms) the worker actually spent inside process(), gated
  // by ENABLE_MATTER_SIM_PROFILING (0 otherwise) — lets SimWorkerPool
  // separate real per-worker compute time from round-trip dispatch/message
  // overhead instead of inferring it from the gap between avgDur and a
  // sampled per-call estimate.
  busyMs: number
}

// What consumers (SimWorkerPool/Coordinator) actually see: MatterSimController
// hydrates the wire message by swapping counts for subarray views onto the
// same shared buffers it holds — a drop-in replacement for the old number[]
// arrays (Int32Array supports for-of/.length identically), with no clone.
export type SimOutMsgDone = {
  type: SimOutMsg.DONE
  next: Int32Array
  vfxJustSettled: Int32Array
  structuralRemovals: Int32Array
  matterTankTransfers: Int32Array
  matterReservationReleases: Int32Array
  liquidNetDelta: number
  solidNetDelta: number
  busyMs: number
}

// Hydrated shape handed to external consumers (SimWorkerPool/Coordinator).
export type SimOutMessage =
  | SimOutMsgReady
  | SimOutMsgDone

// What the real worker script actually posts — DONE carries counts (see
// SimOutMsgDoneWire), not the hydrated Int32Array views.
export type SimOutMessageWire =
  | SimOutMsgReady
  | SimOutMsgDoneWire

export type TypedMatterSimWorker = Omit<Worker, 'postMessage' | 'onmessage'> & {
  postMessage(msg: SimInMessage): void
  onmessage: ((e: MessageEvent<SimOutMessageWire>) => void) | null
}
