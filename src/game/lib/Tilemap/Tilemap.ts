import { Scenes } from 'phaser'
import { type Color32, type PixelData, unpackAlpha } from 'pixel-data-js'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { type MatterType, PERMANENT, SOLID } from '../Matter/_Matter.types.ts'
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

  setFromPixelDataAlpha(pixelData: PixelData, value: MatterType): void {
    if (this.width !== pixelData.w || this.height !== pixelData.h) {
      throw new Error('pixelData must match w/h of tilemap')
    }
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x
        if (unpackAlpha(pixelData.data[idx] as Color32) > 0) {
          this.setTile(x, y, value)
        }
      }
    }
  }

  static makeFromSolidAndPermanentPixelData(
    scene: GameLevel,
    solidData: PixelData,
    permanentData: PixelData,
  ): Tilemap {
    if (solidData.w !== permanentData.w || solidData.h !== permanentData.h) {
      throw new Error('solidData and permanentData must be the same dimensions')
    }
    const { w, h } = solidData
    const tilemap = new Tilemap(scene, w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x
        if (unpackAlpha(permanentData.data[idx] as Color32) > 0) {
          tilemap.setTile(x, y, PERMANENT)
        } else if (unpackAlpha(solidData.data[idx] as Color32) > 0) {
          tilemap.setTile(x, y, SOLID)
        }
      }
    }
    return tilemap
  }
}
