export type ChunkId = number & { readonly __brandChunkId: unique symbol; }
export enum ChunkType {
  EMPTY,
  EDGE,
  CONTAINED
}

export class Chunk {
  public collisionDirty = true
  public renderDirty = true
  public type: ChunkType = ChunkType.EMPTY

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