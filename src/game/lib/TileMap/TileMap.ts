import { Geom } from 'phaser'
import { type Color32, type PixelData, unpackAlpha } from 'pixel-data-js'
import { getCollisionSteps } from '../../helpers/_helpers.ts'
import { truncateArrayRandomly } from '../../helpers/array.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Position } from '../../types.ts'
import { ChunkManager } from './ChunkManager.ts'
import Rectangle = Geom.Rectangle

export type Tile = { x: number, y: number }

export enum TerrainType {
  EMPTY,
  SOLID,
  PERMANENT,
}

export class Tilemap extends SceneBound {
  private tiles: Uint8Array<ArrayBuffer>
  public chunkManager: ChunkManager

  private matter = 0

  constructor(
    public scene: GameLevel,
    readonly width: number,
    readonly height: number,
  ) {
    super(scene)
    this.tiles = new Uint8Array(width * height)

    this.chunkManager = new ChunkManager(scene, width, height)
  }

  public setRect(
    startX: number,
    startY: number,
    width: number,
    height: number,
    value: TerrainType,
  ): void {
    const rect = Rectangle.Intersection(
      new Rectangle(startX, startY, width, height),
      new Rectangle(0, 0, this.width, this.height),
    )

    if (rect.width === 0 || rect.height === 0) {
      throw new Error('Starting coordinates are outside the grid boundaries.')
    }

    const { x: sx, y: sy, width: w, height: h } = rect

    for (let y = sy; y < sy + h; y++) {
      for (let x = sx; x < sx + w; x++) {
        if (this.getTile(x, y) !== value) {
          this.setTile(x, y, value)
        }
      }
    }
  }

  public totalMatter() {
    return this.matter
  }

  // ALWAYS confirm the value is actually going to change
  // before calling this
  public setTile(x: number, y: number, value: TerrainType) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false
    const id = y * this.width + x
    const prev = this.tiles[id]
    this.tiles[id] = value
    this.chunkManager.setDirty(x, y, prev, value)
    if (value === TerrainType.EMPTY) this.matter--
    if (value === TerrainType.SOLID) this.matter++
    return true
  }

  public getTile(x: number, y: number): TerrainType {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return TerrainType.PERMANENT
    return this.tiles[y * this.width + x]
  }

  public isSolid(x: number, y: number) {
    const value = this.getTile(Math.floor(x), Math.floor(y))
    return value === TerrainType.SOLID || value === TerrainType.PERMANENT
  }

  public getTileFromWorld(worldX: number, worldY: number): TerrainType {
    return this.getTile(
      Math.round(worldX),
      Math.round(worldY),
    )
  }

  public getTilePosFromWorld(worldX: number, worldY: number): Position {
    return {
      x: Math.round(worldX),
      y: Math.round(worldY),
    }
  }

  public checkTile(
    tileX: number,
    tileY: number,
    terrainType: TerrainType,
  ) {
    return this.getTile(tileX, tileY) === terrainType
  }

  public checkCircleCollision(
    tileX: number,
    tileY: number,
    tileRadius: number,
    terrainType: TerrainType,
  ) {
    return this.getCircle(tileX, tileY, tileRadius, (x, y) => {
      return this.getTile(x, y) === terrainType
    }, true)
  }

  public getCircle(
    tileX: number,
    tileY: number,
    tileRadius: number,
    cb: (x: number, y: number) => void,
  ): void

  public getCircle(
    tileX: number,
    tileY: number,
    tileRadius: number,
    cb: (x: number, y: number) => boolean,
    returnBoolOnFirstMatch: true,
  ): boolean

  public getCircle(
    tileX: number,
    tileY: number,
    tileRadius: number,
    cb: (x: number, y: number) => any,
    returnBoolOnFirstMatch = false,
  ) {
    const r2 = tileRadius * tileRadius
    const minX = Math.max(0, Math.floor(tileX - tileRadius))
    const maxX = Math.min(this.width - 1, Math.ceil(tileX + tileRadius))
    const minY = Math.max(0, Math.floor(tileY - tileRadius))
    const maxY = Math.min(this.height - 1, Math.ceil(tileY + tileRadius))

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - tileX
        const dy = y - tileY
        if (dx * dx + dy * dy <= r2) {
          const result = cb(x, y)
          if (returnBoolOnFirstMatch && result) {
            return true
          }
        }
      }
    }
    if (returnBoolOnFirstMatch) {
      return false
    }
  }

  public applyEffect(tileX: number, tileY: number, tileRadius: number, newValue: TerrainType, tilesToModify = Number.MAX_VALUE) {

    let tiles: Tile[] = []
    this.getCircle(tileX, tileY, tileRadius, (x, y) => {
      const value = this.getTile(x, y)

      if (value === TerrainType.PERMANENT) return
      if (newValue === value) return

      tiles.push({ x, y })
    })

    if (tilesToModify < tiles.length) {
      tiles = truncateArrayRandomly(tiles, tilesToModify)
    }

    if (!tiles.length) {
      return tiles
    }

    const startTime = this.scene.time.now

    for (const { x, y } of tiles) {
      this.scene.tilemapRenderer.addEffect(x, y, newValue, startTime)
      this.setTile(x, y, newValue)
    }

    return tiles
  }

  checkForCollision(x: number, y: number, vx: number, vy: number, dt: number, scale = 1): {
      collision: true;
      dx: number;
      dy: number;
      stepX: number;
      stepY: number
    }
    | { collision: false; dx: number; dy: number } {
    const { dx, dy, stepDx, stepDy, totalSteps } = getCollisionSteps(vx, vy, dt, scale)
    for (let i = 0; i < totalSteps; i++) {
      const stepX = x + stepDx * i
      const stepY = y + stepDy * i

      const collision = this.getTileFromWorld(stepX, stepY) !== TerrainType.EMPTY
      if (collision) {
        return {
          collision: true,
          dx,
          dy,
          stepX,
          stepY,
        }
      }
    }

    return {
      collision: false,
      dx,
      dy,
    }
  }

  protected onDestroy() {
    // @ts-expect-error: destroy
    this.tiles = null

    // @ts-expect-error: destroy
    this.chunkManager = null
  }

  setFromPixelDataAlpha(pixelData: PixelData, value: TerrainType) {
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

  static makeFromSolidAndPermanentPixelData(scene: GameLevel, solidData: PixelData, permanentData: PixelData) {
    if (solidData.w !== permanentData.w || solidData.h !== permanentData.h) {
      throw new Error('solidData and permanentData must be the same dimensions')
    }

    const { w, h } = solidData
    const tilemap = new Tilemap(scene, w, h)

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x
        if (unpackAlpha(permanentData.data[idx] as Color32) > 0) {
          tilemap.setTile(x, y, TerrainType.PERMANENT)
        } else if (unpackAlpha(solidData.data[idx] as Color32) > 0) {
          tilemap.setTile(x, y, TerrainType.SOLID)
        }
      }
    }

    return tilemap
  }
}
