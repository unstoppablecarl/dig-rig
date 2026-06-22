import { CHUNK_SIZE } from '../../config.ts'

export type ChunkId = number & { readonly __brandChunkId: unique symbol; }

export type Chunk = {
  readonly id: ChunkId,
  readonly cx: number,
  readonly cy: number,
}

export class ChunkMap {
  private chunks = new Map<ChunkId, Chunk>()
  public readonly chunksWide: number
  public readonly chunksHigh: number

  constructor(width: number, height: number) {
    this.chunksWide = Math.ceil(width / CHUNK_SIZE)
    this.chunksHigh = Math.ceil(height / CHUNK_SIZE)

    for (let cy = 0; cy < this.chunksHigh; cy++) {
      for (let cx = 0; cx < this.chunksWide; cx++) {
        const id = (cy * this.chunksWide + cx) as ChunkId
        this.chunks.set(id, { id, cx, cy })
      }
    }
  }

  get(cx: number, cy: number): Chunk | undefined {
    return this.chunks.get((cy * this.chunksWide + cx) as ChunkId)
  }

  destroy(): void {
    // @ts-expect-error: destroy
    this.chunks = null
  }
}
