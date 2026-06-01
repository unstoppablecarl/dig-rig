import { CHUNK_SIZE } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { MatterType } from './_Tilemap-types.ts'
import { Chunk, type ChunkId } from './Chunk.ts'

export class ChunkManager extends SceneBound {
  private chunks = new Map<ChunkId, Chunk>()
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
        const id = (cy * this.width + cx) as ChunkId
        const chunk = new Chunk(id, cx, cy)
        this.chunks.set(id, chunk)
      }
    }
  }

  getChunk(cx: number, cy: number): Chunk | undefined {
    return this.chunks.get((cy * this.width + cx) as ChunkId)
  }

  getChunkById(id: ChunkId): Chunk | undefined {
    return this.chunks.get(id)
  }

  getChunkByTile(tx: number, ty: number): Chunk | undefined {
    const cx = Math.floor(tx / CHUNK_SIZE)
    const cy = Math.floor(ty / CHUNK_SIZE)
    return this.getChunk(cx, cy)
  }

  setDirty(tx: number, ty: number, oldType: MatterType, newType: MatterType) {
    const chunk = this.getChunkByTile(tx, ty)
    if (!chunk) return

    const wasSolid = oldType !== MatterType.EMPTY
    const isSolid  = newType !== MatterType.EMPTY
    if (isSolid && !wasSolid) chunk.solidTileCount++
    if (wasSolid && !isSolid) chunk.solidTileCount--

    const { cx, cy } = chunk

    chunk.setDirty()

    // mark adjacent chunks dirty — glow/outline may cross chunk boundaries
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue
        const neighbor = this.getChunk(cx + dx, cy + dy)
        if (neighbor) neighbor.renderDirty = true
      }
    }
  }

  protected onDestroy() {
    // @ts-expect-error: destroy
    this.chunks = null
  }
}