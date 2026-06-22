import { CHUNK_SIZE } from '../../config.ts'
import { getCollisionSteps } from '../../helpers/_helpers.ts'
import type { Position } from '../../types.ts'
import { EMPTY, isSettled, type MatterType, matterType, PERMANENT, SOLID } from '../Matter/_Matter.types.ts'
import { MatterTypeSet } from '../Matter/data/MatterTypeSet'
import { COLLIDES_WHEN_SETTLED } from '../Matter/matter.ts'
import { ChunkGrid, type ChunkGridBuffers } from './ChunkGrid.ts'

export type Tile = { x: number, y: number }

export class TileGrid {
  readonly tiles: Uint32Array<SharedArrayBuffer>
  readonly chunkGrid: ChunkGrid
  readonly diagonalDistance: number

  constructor(
    readonly sab: SharedArrayBuffer,
    chunkGridBuffers: ChunkGridBuffers,
    readonly width: number,
    readonly height: number,
  ) {
    this.tiles = new Uint32Array(sab)
    const chunksWide = Math.ceil(width / CHUNK_SIZE)
    const chunksHigh = Math.ceil(height / CHUNK_SIZE)
    this.chunkGrid = new ChunkGrid(chunkGridBuffers, chunksWide, chunksHigh)
    this.diagonalDistance = Math.hypot(width, height)
  }

  get tilesBuffer(): SharedArrayBuffer {
    return this.sab
  }

  totalMatter(): number {
    const tiles = this.tiles
    let empty = 0
    for (let i = 0, n = tiles.length; i < n; i++) {
      if (tiles[i] === 0) empty++
    }
    return (this.width * this.height) - empty
  }

  setTile(x: number, y: number, value: MatterType): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false
    this.tiles[y * this.width + x] = value
    return true
  }

  // Returns the raw tile value, which may include SETTLED_FLAG (0x80) in bit 7.
  // Use `value & TYPE_MASK` to get the base MatterType for comparisons.
  getTile(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return PERMANENT
    return this.tiles[y * this.width + x]
  }

  outOfBounds(x: number, y: number): boolean {
    return x < 0 || x >= this.width || y < 0 || y >= this.height
  }

  isCollidable(x: number, y: number): boolean {
    const raw = this.getTile(Math.floor(x), Math.floor(y))
    const type = matterType(raw)
    if (type === SOLID || type === PERMANENT) return true
    if (isSettled(raw)) return COLLIDES_WHEN_SETTLED.has(type)
    return false
  }

  getTileFromWorld(worldX: number, worldY: number): number {
    return this.getTile(Math.round(worldX), Math.round(worldY))
  }

  getTilePosFromWorld(worldX: number, worldY: number): Position {
    return { x: Math.round(worldX), y: Math.round(worldY) }
  }

  checkTile(tileX: number, tileY: number, terrainType: MatterType): boolean {
    return matterType(this.getTile(tileX, tileY)) === terrainType
  }

  checkCircleCollision(
    tileX: number,
    tileY: number,
    tileRadius: number,
    terrainType: MatterType,
  ): boolean {
    return this.getCircle(tileX, tileY, tileRadius, (x, y) => {
      return matterType(this.getTile(x, y)) === terrainType
    }, true)
  }

  getCircle(
    tileX: number,
    tileY: number,
    tileRadius: number,
    cb: (x: number, y: number) => void,
    returnBoolOnFirstMatch?: false,
    innerRadius?: number,
  ): void

  getCircle(
    tileX: number,
    tileY: number,
    tileRadius: number,
    cb: (x: number, y: number) => boolean,
    returnBoolOnFirstMatch: true,
  ): boolean

  getCircle(
    tileX: number,
    tileY: number,
    tileRadius: number,
    cb: (x: number, y: number) => any,
    returnBoolOnFirstMatch = false,
    innerRadius = 0,
  ) {
    const r2 = tileRadius * tileRadius
    const ir2 = innerRadius * innerRadius
    const minY = Math.max(0, Math.floor(tileY - tileRadius))
    const maxY = Math.min(this.height - 1, Math.ceil(tileY + tileRadius))

    for (let y = minY; y <= maxY; y++) {
      const dy = y - tileY
      const dy2 = dy * dy
      if (dy2 > r2) continue

      const outerDx = Math.sqrt(r2 - dy2)
      const xMin = Math.max(0, Math.ceil(tileX - outerDx))
      const xMax = Math.min(this.width - 1, Math.floor(tileX + outerDx))

      if (innerRadius > 0 && dy2 <= ir2) {
        const innerDx = Math.sqrt(ir2 - dy2)
        const xSkipStart = Math.ceil(tileX - innerDx)
        const xSkipEnd = Math.floor(tileX + innerDx)
        for (let x = xMin; x < xSkipStart; x++) {
          const result = cb(x, y)
          if (returnBoolOnFirstMatch && result) return true
        }
        for (let x = xSkipEnd + 1; x <= xMax; x++) {
          const result = cb(x, y)
          if (returnBoolOnFirstMatch && result) return true
        }
      } else {
        for (let x = xMin; x <= xMax; x++) {
          const result = cb(x, y)
          if (returnBoolOnFirstMatch && result) return true
        }
      }
    }
    if (returnBoolOnFirstMatch) return false
  }

  setRect(
    startX: number,
    startY: number,
    width: number,
    height: number,
    value: MatterType,
  ): void {
    const x0 = Math.max(0, startX)
    const y0 = Math.max(0, startY)
    const x1 = Math.min(startX + width, this.width)
    const y1 = Math.min(startY + height, this.height)

    if (x1 <= x0 || y1 <= y0) {
      throw new Error('Starting coordinates are outside the grid boundaries.')
    }

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (this.getTile(x, y) !== value) {
          this.setTile(x, y, value)
        }
      }
    }
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
      if (matterType(this.getTileFromWorld(stepX, stepY)) !== EMPTY) {
        return { collision: true, dx, dy, stepX, stepY }
      }
    }
    return { collision: false, dx, dy }
  }

  _collisionPosition: Position = { x: 0, y: 0 }

  getAngleRayCollision(
    startX: number,
    startY: number,
    angle: number,
    types: MatterTypeSet,
    maxDistance = this.diagonalDistance,
  ): Position {
    return this.getRayCollision(startX, startY, Math.cos(angle), Math.sin(angle), types, maxDistance)
  }

  getRayCollision(
    startX: number,
    startY: number,
    directionX: number,
    directionY: number,
    types: MatterTypeSet,
    maxDistance = this.diagonalDistance,
  ): Position {
    const len = Math.sqrt(directionX * directionX + directionY * directionY)
    if (len === 0) return { x: startX, y: startY }

    const nx = directionX / len
    const ny = directionY / len

    for (let d = 0; d <= maxDistance; d++) {
      const x = Math.round(startX + nx * d)
      const y = Math.round(startY + ny * d)
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
        const prev = Math.max(d - 1, 0)
        this._collisionPosition.x = Math.round(startX + nx * prev)
        this._collisionPosition.y = Math.round(startY + ny * prev)
        return this._collisionPosition
      }
      if (types.has(matterType(this.getTile(x, y)))) {
        this._collisionPosition.x = x
        this._collisionPosition.y = y
        return this._collisionPosition
      }
    }

    this._collisionPosition.x = Math.round(startX + nx * maxDistance)
    this._collisionPosition.y = Math.round(startY + ny * maxDistance)
    return this._collisionPosition
  }

  setBorder(thickness: number, value: MatterType) {
    const { width, height } = this
    for (let t = 0; t < thickness; t++) {
      for (let x = t; x < width - t; x++) {
        this.setTile(x, t, value)
        this.setTile(x, height - 1 - t, value)
      }
      for (let y = t + 1; y < height - 1 - t; y++) {
        this.setTile(t, y, value)
        this.setTile(width - 1 - t, y, value)
      }
    }
  }
}
