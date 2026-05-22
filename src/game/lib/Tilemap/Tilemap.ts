import { Geom } from 'phaser'
import { type Color32, type PixelData, unpackAlpha } from 'pixel-data-js'
import { FireMode } from '../../config.ts'
import { getCollisionSteps } from '../../helpers/_helpers.ts'
import { truncateArrayRandomly } from '../../helpers/array.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Position } from '../../types.ts'
import { PLAYER_HEIGHT, PLAYER_WIDTH } from '../Player/Player.ts'
import { TerrainType } from './_Tilemap-types.ts'
import { ChunkManager } from './ChunkManager.ts'
import Rectangle = Geom.Rectangle

export type Tile = { x: number, y: number }

const PLAYER_RADIUS_X = PLAYER_WIDTH * 0.5
const PLAYER_RADIUS_Y = PLAYER_HEIGHT * 0.5

export class Tilemap extends SceneBound {
  private tiles: Uint8Array<ArrayBuffer>
  public chunkManager: ChunkManager

  private matter = 0

  readonly diagonalDistance: number

  constructor(
    readonly scene: GameLevel,
    readonly width: number,
    readonly height: number,
  ) {
    super(scene)
    this.tiles = new Uint8Array(width * height)

    this.diagonalDistance = Math.hypot(width, height)

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
    if (prev === TerrainType.SOLID && value !== TerrainType.SOLID) this.matter--
    if (prev !== TerrainType.SOLID && value === TerrainType.SOLID) this.matter++
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
  _appyEffectTiles: Tile[] = []

  public applyEffect(tileX: number, tileY: number, tileRadius: number, mode: FireMode, tilesToModify = Number.MAX_VALUE) {
    const { x: px, y: py } = this.scene.player
    const velocity = this.scene.player.container.body?.velocity
    const vx = velocity?.x ?? 0
    const vy = velocity?.y ?? 0
    const MAX_VEL_EXTEND = 8
    const velLeft = Math.max(Math.min(vx, 0), -MAX_VEL_EXTEND)
    const velRight = Math.min(Math.max(vx, 0), MAX_VEL_EXTEND)
    const velUp = Math.max(Math.min(vy, 0), -MAX_VEL_EXTEND)
    const velDown = Math.min(Math.max(vy, 0), MAX_VEL_EXTEND)

    this._appyEffectTiles.length = 0
    const tiles = this._appyEffectTiles
    let newValue: TerrainType = TerrainType.EMPTY
    if(mode === FireMode.CREATE){
      newValue = TerrainType.SOLID
    }

    this.getCircle(tileX, tileY, tileRadius, (x, y) => {
      const value = this.getTile(x, y)

      if (value === TerrainType.PERMANENT) return
      if (newValue === value) return
      if (
        newValue === TerrainType.SOLID &&
        x > px - PLAYER_RADIUS_X + velLeft &&
        x < px + PLAYER_RADIUS_X + velRight &&
        y > py - PLAYER_RADIUS_Y + velUp &&
        y < py + PLAYER_RADIUS_Y + velDown
      ) return

      tiles.push({ x, y })
    })

    if (tilesToModify < tiles.length) {
      truncateArrayRandomly(tiles, tilesToModify)
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

  _collisionPosition: Position = { x: 0, y: 0 }

  getAngleCollision(
    startX: number,
    startY: number,
    angle: number,
    types: Set<TerrainType>,
    maxDistance = this.diagonalDistance,
  ): Position {
    const vx = Math.cos(angle)
    const vy = Math.sin(angle)

    return this.getCollision(
      startX,
      startY,
      vx,
      vy,
      types,
      maxDistance,
    )
  }

  getCollision(
    startX: number,
    startY: number,
    directionX: number,
    directionY: number,
    types: Set<TerrainType>,
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
      if (types.has(this.getTile(x, y))) {
        this._collisionPosition.x = x
        this._collisionPosition.y = y
        return this._collisionPosition
      }
    }

    this._collisionPosition.x = Math.round(startX + nx * maxDistance)
    this._collisionPosition.y = Math.round(startY + ny * maxDistance)
    return this._collisionPosition
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
