import type { Tilemap } from '../../Tilemap/Tilemap.ts'

export type TileFrontBuffers = {
  tiles: SharedArrayBuffer
  fill: SharedArrayBuffer
  gen: SharedArrayBuffer
}

// Front (renderer-visible) side of the tile double-buffer.
//
// The coordinator worker owns the back buffers (tilesBuffer / fillBuffer on
// Tilemap) and writes to them freely during each simulation step.  After every
// complete step, TilePublisher copies dirty chunks from back → front and bumps
// the per-chunk gen counter via Atomics.add (release fence).  The main-thread
// renderer reads gen with Atomics.load (acquire fence) before sampling tiles
// and fill, so it always sees a coherent post-step snapshot with no tearing and
// without needing to skip frames.
//
// makeBuffers() pre-seeds tiles from the current tilemap state and initializes
// gen to 1 (matching markAllRenderDirty) so the first render frame uploads
// terrain before the coordinator has run its first step.
export class TileFrontData {
  readonly tiles: Uint32Array
  readonly fill: Uint32Array
  // Int32Array is needed for Atomics.load/add
  readonly genView: Int32Array

  static makeBuffers(tilemap: Tilemap): TileFrontBuffers {
    const { chunksWide, chunksHigh } = tilemap.chunkGrid

    const gen = new SharedArrayBuffer(chunksWide * chunksHigh * Int32Array.BYTES_PER_ELEMENT)
    new Int32Array(gen).fill(1)

    return {
      tiles: tilemap.buffers.tiles.slice(0),
      fill: tilemap.buffers.fillLevels.slice(0),
      gen,
    }
  }

  constructor(readonly buffers: TileFrontBuffers) {
    this.tiles = new Uint32Array(buffers.tiles)
    this.fill = new Uint32Array(buffers.fill)
    this.genView = new Int32Array(buffers.gen)
  }
}
