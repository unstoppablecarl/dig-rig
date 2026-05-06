import { CHUNK_SIZE } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { Chunk } from './Chunk.ts'

export class ChunkManager extends SceneBound {
  private chunks = new Map<string, Chunk>()
  public readonly width: number
  public readonly height: number

  constructor(
    public scene: GameLevel,
    tilemapWidth: number,
    tilemapHeight: number,
  ) {
    super(scene)

    this.width = Math.ceil(tilemapWidth / CHUNK_SIZE)
    this.height = Math.ceil(tilemapHeight / CHUNK_SIZE)

    for (let cy = 0; cy < this.height; cy++) {
      for (let cx = 0; cx < this.width; cx++) {
        const id = cy * this.width + cx
        const key = getChunkKey(cx, cy)
        let chunk = new Chunk(id, cx, cy)
        this.chunks.set(key, chunk)
      }
    }
  }

  getChunk(cx: number, cy: number): Chunk | undefined {
    return this.chunks.get(getChunkKey(cx, cy))
  }

  getChunkByKey(key: string): Chunk | undefined {
    return this.chunks.get(key)
  }

  getChunkByTile(tx: number, ty: number): Chunk | undefined {
    const cx = Math.floor(tx / CHUNK_SIZE)
    const cy = Math.floor(ty / CHUNK_SIZE)
    return this.getChunk(cx, cy)
  }

  setDirty(tx: number, ty: number) {
    const chunk = this.getChunkByTile(tx, ty)
    if (!chunk) return

    const { cx, cy } = chunk

    chunk.setDirty()

    // mark adjacent dirty outlines may be invalid
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const chunk = this.getChunk(cx + dx, cy + dy)
        if (chunk) {
          chunk.renderDirty = true
        }
      }
    }
  }

  destroy() {
    super.destroy()
    // @ts-expect-error: destroy
    this.chunks = null
  }
}

export const getChunkKey = (cx: number, cy: number): string => `${cx},${cy}`
