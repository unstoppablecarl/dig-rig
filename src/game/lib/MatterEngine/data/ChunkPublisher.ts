import { CHUNK_SIZE } from '../../../config.ts'
import type { ChunkGrid } from '../../Tilemap/ChunkGrid.ts'
import type { TileFrontData } from './TileFrontData.ts'

// Double-buffer bridge between worker tile writes and main-thread rendering.
//
// Workers write to the back buffers (tiles/fill SABs) freely.  After each
// complete step the coordinator calls publish(), which copies dirty chunks from
// back to front and then does Atomics.add on front.genView (release fence).  The
// renderer reads genView with Atomics.load (acquire fence) so it always sees a
// fully consistent post-step snapshot — no gate, no skipped frames.
export class ChunkPublisher {
  private readonly tiles: Uint32Array
  private readonly fill: Float32Array
  private readonly front: TileFrontData
  private readonly lastWorkerGen: Uint8Array
  private readonly chunksWide: number
  private readonly chunksHigh: number
  private readonly width: number
  private readonly height: number

  constructor(
    tilesBack: SharedArrayBuffer,
    fillBack: SharedArrayBuffer,
    front: TileFrontData,
    chunkGrid: ChunkGrid,
    width: number,
    height: number,
  ) {
    this.tiles = new Uint32Array(tilesBack)
    this.fill = new Float32Array(fillBack)
    this.front = front
    this.chunksWide = chunkGrid.chunksWide
    this.chunksHigh = chunkGrid.chunksHigh
    this.width = width
    this.height = height

    const total = chunkGrid.chunksWide * chunkGrid.chunksHigh
    this.lastWorkerGen = new Uint8Array(total)
    // Sync to current renderGen so we don't re-publish tiles that were already
    // copied into tilesFront during DataManager.make() initialisation.
    for (let i = 0; i < total; i++) {
      this.lastWorkerGen[i] = chunkGrid.getRenderGen(i)
    }
  }

  publish(chunkGrid: ChunkGrid): void {
    const { chunksWide, chunksHigh, width, height, front } = this
    const size = chunksWide * chunksHigh
    for (let cIdx = 0; cIdx < size; cIdx++) {
      const wGen = chunkGrid.getRenderGen(cIdx)
      if (wGen === this.lastWorkerGen[cIdx]) continue
      this.lastWorkerGen[cIdx] = wGen

      const cx = cIdx % chunksWide
      const cy = (cIdx / chunksWide) | 0
      const x0 = cx * CHUNK_SIZE
      const y0 = cy * CHUNK_SIZE
      const copyW = Math.min(CHUNK_SIZE, width - x0)
      const copyH = Math.min(CHUNK_SIZE, height - y0)
      const ySize = y0 + copyH
      for (let y = y0; y < ySize; y++) {
        const off = y * width + x0
        front.tiles.set(this.tiles.subarray(off, off + copyW), off)
        front.fill.set(this.fill.subarray(off, off + copyW), off)
      }
      // Release fence: all prior copies are visible before the gen increment.
      Atomics.add(front.genView, cIdx, 1)
    }
  }
}
