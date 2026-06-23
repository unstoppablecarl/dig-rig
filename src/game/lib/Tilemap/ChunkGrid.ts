import { CHUNK_SIZE } from '../../config.ts'
import { type Buffers, makeSOABuffers, type Schema, soaBuffersToViews } from '../Util/StructOfArrays.ts'
import type { ChunkId } from './ChunkMap.ts'

const SCHEMA = {
  solidCount: Uint16Array,  // 0 – CHUNK_SIZE²
  anchored: Uint8Array,   // 0 | 1
  renderGen: Uint8Array,   // monotonic counter, worker increments on dirty
  collGen: Uint8Array,   // monotonic counter, worker increments on dirty
} as const satisfies Schema

export type ChunkGridSchema = typeof SCHEMA
export type ChunkGridBuffers = Buffers<ChunkGridSchema> & {
  chunksWide: number
  chunksHigh: number
}

export enum ChunkType {
  EMPTY,
  FULL,
  PARTIAL
}

const CHUNK_MAX_SOLID = CHUNK_SIZE * CHUNK_SIZE

export class ChunkGrid {
  private readonly solidCount: Uint16Array
  private readonly anchored: Uint8Array
  private readonly renderGen: Uint8Array
  private readonly collGen: Uint8Array

  readonly chunksWide: number
  readonly chunksHigh: number

  readonly buffers: ChunkGridBuffers

  /** Create a fresh ChunkGrid with its own SABs (main thread, at level load). */
  static createBuffers(width: number, height: number): ChunkGridBuffers {
    const chunksWide = Math.ceil(width / CHUNK_SIZE)
    const chunksHigh = Math.ceil(height / CHUNK_SIZE)
    return {
      ...makeSOABuffers(SCHEMA, chunksWide * chunksHigh),
      chunksWide,
      chunksHigh,
    }
  }

  static fromBuffers(buffers: ChunkGridBuffers) {
    return new ChunkGrid(buffers, buffers.chunksWide, buffers.chunksHigh)
  }

  /** Attach to existing SABs (worker side, after INIT message). */
  constructor(buffers: ChunkGridBuffers, chunksWide: number, chunksHigh: number) {
    const views = soaBuffersToViews(SCHEMA, buffers)
    this.solidCount = views.solidCount
    this.anchored = views.anchored
    this.renderGen = views.renderGen
    this.collGen = views.collGen

    this.chunksWide = chunksWide
    this.chunksHigh = chunksHigh

    this.buffers = buffers
  }

  idx(cx: number, cy: number): number {
    return cy * this.chunksWide + cx
  }

  getSolidCount(idx: number): number {
    return this.solidCount[idx]
  }

  getType(idx: number): ChunkType {
    const count = this.solidCount[idx]
    if (count === 0) return ChunkType.EMPTY
    if (count === CHUNK_MAX_SOLID) return ChunkType.FULL
    return ChunkType.PARTIAL
  }

  isAnchored(idx: number): boolean {
    return this.anchored[idx] !== 0
  }

  isAnchoredCoord(cx: number, cy: number): boolean {
    return this.anchored[(cy * this.chunksWide + cx) as ChunkId] !== 0
  }

  /** Current render generation counter. Main thread compares against its local shadow. */
  getRenderGen(idx: number): number {
    return this.renderGen[idx]
  }

  /** Current collision generation counter. Main thread compares against its local shadow. */
  getCollGen(idx: number): number {
    return this.collGen[idx]
  }

  // ------------------------------------------------------------------
  // Worker-only writes
  // Each method is a single-writer operation; no main-thread RMW on these fields.
  // ------------------------------------------------------------------

  setSolidCount(idx: number, count: number): void {
    this.solidCount[idx] = count
  }

  setAnchored(idx: number, val: boolean): void {
    this.anchored[idx] = val ? 1 : 0
  }

  /** Signal both render and collision dirty to the main thread. */
  markDirty(idx: number): void {
    this.renderGen[idx]++
    this.collGen[idx]++
  }

  /** Signal render-only dirty (e.g. neighbor border-pixel refresh). */
  markRenderDirty(idx: number): void {
    this.renderGen[idx]++
  }

  // Init helper — called once from main thread before workers start
  // Stamp renderGen=1 on every chunk so the renderer uploads all tiles on the first frame.
  markAllRenderDirty(): void {
    this.renderGen.fill(1)
  }
}
