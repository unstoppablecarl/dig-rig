import { CHUNK_SIZE } from '../../config.ts'

export type ChunkId = number & { readonly __brandChunkId: unique symbol; }

export enum ChunkType {
  EMPTY,
  FULL,
  PARTIAL
}

export class Chunk {
  public collisionDirty = true
  public renderDirty = true
  public solidTileCount: number = 0
  public anchored = false

  get type(): ChunkType {
    if (this.solidTileCount === 0) return ChunkType.EMPTY
    if (this.solidTileCount === CHUNK_SIZE * CHUNK_SIZE) return ChunkType.FULL
    return ChunkType.PARTIAL
  }

  constructor(
    readonly id: ChunkId,
    readonly cx: number,
    readonly cy: number,
  ) {
  }

  setDirty() {
    this.renderDirty = true
    this.collisionDirty = true
  }
}