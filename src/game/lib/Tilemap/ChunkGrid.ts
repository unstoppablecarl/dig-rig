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

  /** Attach to existing SABs (worker side, after INIT message). */
  constructor(buffers: ChunkGridBuffers) {
    const views = soaBuffersToViews(SCHEMA, buffers)
    this.solidCount = views.solidCount
    this.anchored = views.anchored
    this.renderGen = views.renderGen
    this.collGen = views.collGen

    this.chunksWide = buffers.chunksWide
    this.chunksHigh = buffers.chunksHigh

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

  // TEMP DEBUG: trace every distinct call site that bumps collGen, and how
  // often each one fires, to find the remaining source of continuous
  // "shape UNCHANGED (wasted rebuild)" terrain-collision churn. Remove once found.
  private _markDirtyStackCounts = new Map<string, number>()

  /** Signal both render and collision dirty to the main thread. */
  markDirty(idx: number): void {
    this.renderGen[idx]++
    this.collGen[idx]++

    if (import.meta.env.DEV) {
      const stack = (new Error().stack ?? '').split('\n').slice(1, 5).join('\n')
      const count = (this._markDirtyStackCounts.get(stack) ?? 0) + 1
      this._markDirtyStackCounts.set(stack, count)
    }
  }

  /** Signal render-only dirty (e.g. neighbor border-pixel refresh). */
  markRenderDirty(idx: number): void {
    this.renderGen[idx]++
  }

  markRenderDirtyTile(tx: number, ty: number): void {
    const cy = (ty / CHUNK_SIZE) | 0
    const cx = (tx / CHUNK_SIZE) | 0
    const chunkIdx = cy * this.chunksWide + cx
    this.renderGen[chunkIdx]++
  }

  // Init helper — called once from main thread before workers start
  // Stamp renderGen=1 on every chunk so the renderer uploads all tiles on the first frame.
  markAllRenderDirty(): void {
    this.renderGen.fill(1)
  }
}
