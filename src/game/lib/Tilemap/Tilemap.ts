import { Scenes } from 'phaser'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { ChunkMap } from './ChunkMap.ts'
import { TileGrid } from './TileGrid.ts'
import DESTROY = Scenes.Events.DESTROY
import SHUTDOWN = Scenes.Events.SHUTDOWN

export class Tilemap extends TileGrid {
  public chunkMap: ChunkMap

  private _destroyed = false

  get destroyed(): boolean {
    return this._destroyed
  }

  constructor(
    readonly scene: GameLevel,
    width: number,
    height: number,
  ) {
    const buffers = TileGrid.makeBuffer(width, height)
    super(buffers)

    this.chunkGrid.markAllRenderDirty()
    this.chunkMap = new ChunkMap(width, height)

    scene.events.once(DESTROY, this.destroy, this)
    scene.events.once(SHUTDOWN, this.destroy, this)
  }

  destroy(): void {
    if (this._destroyed) return
    this._destroyed = true
    this.scene?.events.off(DESTROY, this.destroy, this)
    this.scene?.events.off(SHUTDOWN, this.destroy, this)

    this.chunkMap.destroy()
    // @ts-expect-error: destroy
    this.chunkMap = null
  }
}
