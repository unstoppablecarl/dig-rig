import type { GameLevel } from '../../scenes/GameLevel.ts'
import { TILE_SIZE } from '../../config.ts'
import { makeTerrainEffect } from '../makeTerrainEffect.ts'
import { getCollisionSteps } from '../../helpers/_helpers.ts'
import type { Position } from '../../types.ts'
import { ChunkManager } from './ChunkManager.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import { truncateArrayRandomly } from '../../helpers/array.ts'

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
    if (startY < 0 || startX < 0 || startY > this.height || startX > this.width) {
      throw new Error('Starting coordinates are outside the grid boundaries.')
      return
    }

    for (let y = startY; y < startY + height; y++) {
      for (let x = startX; x < startX + width; x++) {
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
    this.tiles[y * this.width + x] = value
    this.chunkManager.setDirty(x, y)
    if (value === TerrainType.EMPTY) this.matter--
    if (value === TerrainType.SOLID) this.matter++
    return true
  }

  public getTile(x: number, y: number): TerrainType {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return TerrainType.PERMANENT
    return this.tiles[y * this.width + x] ?? TerrainType.EMPTY
  }

  public isSolid(x: number, y: number) {
    let value = this.getTile(Math.floor(x), Math.floor(y))
    return value === TerrainType.SOLID || value === TerrainType.PERMANENT
  }

  public getTileFromWorld(worldX: number, worldY: number): TerrainType {
    return this.getTile(
      Math.round(worldX / TILE_SIZE),
      Math.round(worldY / TILE_SIZE),
    )
  }

  public getTilePosFromWorld(worldX: number, worldY: number): Position {
    return {
      x: Math.round(worldX / TILE_SIZE),
      y: Math.round(worldY / TILE_SIZE),
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

    const effect = makeTerrainEffect(this.scene)

    for (let { x, y } of tiles) {
      effect.addTile(x, y, newValue)
      this.setTile(x, y, newValue)
    }

    effect.start()

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

  destroy() {
    super.destroy()

    // @ts-expect-error: destroy
    this.tiles = null

    // @ts-expect-error: destroy
    this.chunkManager = null
  }
}