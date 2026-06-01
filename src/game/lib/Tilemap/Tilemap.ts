import { Geom } from 'phaser'
import { type Color32, type PixelData, unpackAlpha } from 'pixel-data-js'
import { getCollisionSteps } from '../../helpers/_helpers.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Position } from '../../types.ts'
import { MatterType } from '../Matter/_Matter-types.ts'
import { FireMode } from '../Player/_FireMode-types'
import { PLAYER_HEIGHT, PLAYER_WIDTH } from '../Player/Player.ts'
import { ChunkManager } from './ChunkManager.ts'
import Rectangle = Geom.Rectangle

export type Tile = { x: number, y: number }

const PLAYER_RADIUS_X = PLAYER_WIDTH * 0.5
const PLAYER_RADIUS_Y = PLAYER_HEIGHT * 0.5
// How far the player AABB is extended in the direction of movement when filtering creates.
const PLAYER_CREATE_VEL_EXTEND = 8

export type TileEffectResult = Tile & {
  newValue: MatterType,
}

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
    value: MatterType,
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
  public setTile(x: number, y: number, value: MatterType) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false
    const id = y * this.width + x
    const prev = this.tiles[id]
    this.tiles[id] = value
    this.chunkManager.setDirty(x, y, prev, value)
    if (prev === MatterType.SOLID && value !== MatterType.SOLID) this.matter--
    if (prev !== MatterType.SOLID && value === MatterType.SOLID) this.matter++
    return true
  }

  public getTile(x: number, y: number): MatterType {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return MatterType.PERMANENT
    return this.tiles[y * this.width + x]
  }

  public isSolid(x: number, y: number) {
    const value = this.getTile(Math.floor(x), Math.floor(y))
    return value === MatterType.SOLID || value === MatterType.PERMANENT
  }

  public getTileFromWorld(worldX: number, worldY: number): MatterType {
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
    terrainType: MatterType,
  ) {
    return this.getTile(tileX, tileY) === terrainType
  }

  public checkCircleCollision(
    tileX: number,
    tileY: number,
    tileRadius: number,
    terrainType: MatterType,
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
    returnBoolOnFirstMatch?: false,
    innerRadius?: number,
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

  // Assumes tiles is sorted center-outward. commitEffectTiles sorts before calling this.
  // Keeps the inner core intact and randomly samples only the outermost ring.
  private truncatePreservingCenter<T extends { x: number; y: number }>(
    tiles: T[],
    tileX: number,
    tileY: number,
    targetSize: number,
  ): void {
    if (targetSize >= tiles.length) return

    const last = tiles[targetSize - 1]
    const cutoffD2 = (last.x - tileX) ** 2 + (last.y - tileY) ** 2

    let ringStart = targetSize - 1
    while (ringStart > 0 && (tiles[ringStart - 1].x - tileX) ** 2 + (tiles[ringStart - 1].y - tileY) ** 2 === cutoffD2) {
      ringStart--
    }

    let ringEnd = targetSize
    while (ringEnd < tiles.length && (tiles[ringEnd].x - tileX) ** 2 + (tiles[ringEnd].y - tileY) ** 2 === cutoffD2) {
      ringEnd++
    }

    // Partial Fisher-Yates: randomly select `need` tiles from the ring in-place, O(need)
    const need = targetSize - ringStart
    const ringSize = ringEnd - ringStart
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(Math.random() * (ringSize - i))
      const a = ringStart + i
      const b = ringStart + j
      const tmp = tiles[a]
      tiles[a] = tiles[b]
      tiles[b] = tmp
    }
    tiles.length = targetSize
  }

  public applyEffect(out: TileEffectResult[], tileX: number, tileY: number, tileRadius: number, mode: FireMode, tilesToModify = Number.MAX_VALUE, innerRadius = 0) {
    const tiles = out
    tiles.length = 0
    if (mode === FireMode.CREATE) {
      const { x: px, y: py } = this.scene.player
      const vel = this.scene.player.container.body?.velocity
      const vx = vel?.x ?? 0, vy = vel?.y ?? 0
      const MAX_VEL_EXTEND = 8
      const velLeft = Math.max(Math.min(vx, 0), -MAX_VEL_EXTEND)
      const velRight = Math.min(Math.max(vx, 0), MAX_VEL_EXTEND)
      const velUp = Math.max(Math.min(vy, 0), -MAX_VEL_EXTEND)
      const velDown = Math.min(Math.max(vy, 0), MAX_VEL_EXTEND)
      this.getCircle(tileX, tileY, tileRadius, (x, y) => {
        if (this.getTile(x, y) !== MatterType.EMPTY) return
        if (x > px - PLAYER_RADIUS_X + velLeft && x < px + PLAYER_RADIUS_X + velRight &&
          y > py - PLAYER_RADIUS_Y + velUp && y < py + PLAYER_RADIUS_Y + velDown) return
        tiles.push({ x, y, newValue: MatterType.SOLID })
      }, false, innerRadius)
      if (!this.commitEffectTiles(tiles, tileX, tileY, tilesToModify, mode)) return tiles

    } else if (mode === FireMode.DESTROY) {
      this.getCircle(tileX, tileY, tileRadius, (x, y) => {
        const value = this.getTile(x, y)
        if (value === MatterType.PERMANENT || value === MatterType.EMPTY) return
        tiles.push({ x, y, newValue: MatterType.EMPTY })
      })
      if (!this.commitEffectTiles(tiles, tileX, tileY, tilesToModify, mode)) return tiles

    }

    return tiles
  }

  public applyCreateTiles(tiles: Tile[]): Tile[] {
    if (!tiles.length) return tiles
    const player = this.scene.player
    if (player) {
      const px = player.x, py = player.y
      const vel = player.container.body?.velocity
      const vx = vel?.x ?? 0, vy = vel?.y ?? 0
      const velLeft = Math.max(Math.min(vx, 0), -PLAYER_CREATE_VEL_EXTEND)
      const velRight = Math.min(Math.max(vx, 0), PLAYER_CREATE_VEL_EXTEND)
      const velUp = Math.max(Math.min(vy, 0), -PLAYER_CREATE_VEL_EXTEND)
      const velDown = Math.min(Math.max(vy, 0), PLAYER_CREATE_VEL_EXTEND)
      const left = px - PLAYER_RADIUS_X + velLeft
      const right = px + PLAYER_RADIUS_X + velRight
      const top = py - PLAYER_RADIUS_Y + velUp
      const bot = py + PLAYER_RADIUS_Y + velDown
      tiles = tiles.filter(({ x, y }) => !(x > left && x < right && y > top && y < bot))
      if (!tiles.length) return tiles
    }
    const startTime = this.scene.time.now
    for (const { x, y } of tiles) {
      this.scene.tilemapRenderer.addEffect(x, y, FireMode.CREATE, startTime)
      this.setTile(x, y, MatterType.SOLID)
    }

    return tiles
  }

  private commitEffectTiles(
    tiles: TileEffectResult[],
    tileX: number,
    tileY: number,
    tilesToModify: number,
    mode: FireMode,
  ): boolean {
    if (tilesToModify < tiles.length) {
      tiles.sort((a, b) =>
        ((a.x - tileX) ** 2 + (a.y - tileY) ** 2) - ((b.x - tileX) ** 2 + (b.y - tileY) ** 2),
      )
    }
    this.truncatePreservingCenter(tiles, tileX, tileY, tilesToModify)
    if (!tiles.length) return false
    const startTime = this.scene.time.now
    for (const { x, y, newValue } of tiles) {
      this.scene.tilemapRenderer.addEffect(x, y, mode, startTime)
      this.setTile(x, y, newValue)
    }
    return true
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

      const collision = this.getTileFromWorld(stepX, stepY) !== MatterType.EMPTY
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

  setFromPixelDataAlpha(pixelData: PixelData, value: MatterType) {
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

  getAngleRayCollision(
    startX: number,
    startY: number,
    angle: number,
    types: Set<MatterType>,
    maxDistance = this.diagonalDistance,
  ): Position {
    const vx = Math.cos(angle)
    const vy = Math.sin(angle)

    return this.getRayCollision(
      startX,
      startY,
      vx,
      vy,
      types,
      maxDistance,
    )
  }

  getRayCollision(
    startX: number,
    startY: number,
    directionX: number,
    directionY: number,
    types: Set<MatterType>,
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
          tilemap.setTile(x, y, MatterType.PERMANENT)
        } else if (unpackAlpha(solidData.data[idx] as Color32) > 0) {
          tilemap.setTile(x, y, MatterType.SOLID)
        }
      }
    }

    return tilemap
  }
}
