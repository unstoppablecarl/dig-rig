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

type TileEffectResult = Tile & {
  newValue: TerrainType,
}

export class Tilemap extends SceneBound {
  private readonly sab: SharedArrayBuffer
  private tiles: Uint8Array<SharedArrayBuffer>
  public chunkManager: ChunkManager
  public onTileEmpty?: (tx: number, ty: number) => void
  public onIslandDetected?: (tiles: Tile[]) => void

  private matter = 0

  readonly diagonalDistance: number

  constructor(
    readonly scene: GameLevel,
    readonly width: number,
    readonly height: number,
  ) {
    super(scene)
    this.sab = new SharedArrayBuffer(width * height)
    this.tiles = new Uint8Array(this.sab)

    this.diagonalDistance = Math.hypot(width, height)

    this.chunkManager = new ChunkManager(scene, width, height)
  }

  get tilesBuffer(): SharedArrayBuffer {
    return this.sab
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
    if (value === TerrainType.EMPTY) this.onTileEmpty?.(x, y)
    return true
  }

  public getTile(x: number, y: number): TerrainType {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return TerrainType.PERMANENT
    return this.tiles[y * this.width + x]
  }

  public isSolid(x: number, y: number) {
    const value = this.getTile(Math.floor(x), Math.floor(y))
    return value === TerrainType.SOLID || value === TerrainType.PERMANENT || value === TerrainType.SAND_SETTLED
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

  private isFluid(t: TerrainType): boolean {
    return t === TerrainType.SAND || t === TerrainType.SAND_SETTLED || t === TerrainType.WATER
  }

  // Returns the subset of newTiles that form a floating island (not connected to any
  // PERMANENT tile or world boundary via solid).  Relies on chunkManager.anchored
  // flags being current before this is called.
  //
  // Three cases, cheapest first:
  //   1. No existing solid neighbour          → trivially an island, no BFS
  //   2. Neighbour is in an anchored chunk    → trivially anchored, no BFS
  //   3. Neighbour is in an unanchored chunk  → tile BFS, but bounded to the
  //                                             unanchored region (typically tiny)
  public findIslandTiles(newTiles: Tile[]): Tile[] {
    if (newTiles.length === 0) return []

    const newSet = new Set<number>(newTiles.map(({ x, y }) => y * this.width + x))

    let touchesAnchoredSolid = false
    let touchesUnanchoredSolid = false

    for (const { x, y } of newTiles) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nx = x + dx, ny = y + dy
        const nidx = ny * this.width + nx
        if (newSet.has(nidx)) continue
        const nTile = this.getTile(nx, ny)
        if (nTile === TerrainType.PERMANENT) return []
        if (nTile !== TerrainType.SOLID) continue
        if (this.chunkManager.getChunkByTile(nx, ny)?.anchored) {
          touchesAnchoredSolid = true
        } else {
          touchesUnanchoredSolid = true
        }
      }
      if (touchesAnchoredSolid) break
    }

    if (touchesAnchoredSolid) return []
    if (!touchesUnanchoredSolid) return newTiles

    // Touches only unanchored solid — BFS stays within the unanchored region
    const visited = new Set<number>(newSet)
    const queue: [number, number][] = newTiles.map(({ x, y }) => [x, y] as [number, number])
    let head = 0
    let anchored = false

    outer: while (head < queue.length) {
      const [x, y] = queue[head++]
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
          anchored = true
          break outer
        }
        const nidx = ny * this.width + nx
        if (visited.has(nidx)) continue
        visited.add(nidx)
        const nTile = this.getTile(nx, ny)
        if (nTile === TerrainType.PERMANENT) {
          anchored = true
          break outer
        }
        if (nTile === TerrainType.SOLID) {
          if (this.chunkManager.getChunkByTile(nx, ny)?.anchored) {
            anchored = true
            break outer
          }
          queue.push([nx, ny])
        }
      }
    }

    return anchored ? [] : newTiles
  }

  // After solid tiles are destroyed, checks adjacent solid for disconnection.
  // Only TerrainType.SOLID forms structural connections — SAND, SAND_SETTLED, and
  // WATER are transparent to this BFS (neither a connection nor a blocking wall).
  // No BFS cap: connected terrain always finds PERMANENT in a small number of hops
  // because PERMANENT tiles exist at the world boundary which is never far from
  // any solid tile.  Genuine islands exhaust their component and are detected
  // regardless of size.
  private findNewlyDisconnectedByDestruction(destroyedTiles: Tile[]): Tile[] {
    const globalVisited = new Set<number>()
    const islandTiles: Tile[] = []

    for (const { x: dx, y: dy } of destroyedTiles) {
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const sx = dx + ox, sy = dy + oy
        if (sx < 0 || sx >= this.width || sy < 0 || sy >= this.height) continue
        const sidx = sy * this.width + sx
        if (globalVisited.has(sidx)) continue
        if (this.getTile(sx, sy) !== TerrainType.SOLID) continue

        const component: Tile[] = []
        const queue: [number, number][] = [[sx, sy]]
        let head = 0
        const localVisited = new Set<number>([sidx])
        let anchored = false

        outer: while (head < queue.length) {
          const [cx, cy] = queue[head++]
          component.push({ x: cx, y: cy })

          for (const [ndx, ndy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
            const nx = cx + ndx, ny = cy + ndy
            if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
              anchored = true
              break outer
            }
            const nidx = ny * this.width + nx
            if (localVisited.has(nidx)) continue
            const nTile = this.getTile(nx, ny)
            if (nTile === TerrainType.PERMANENT) {
              anchored = true
              break outer
            }
            if (nTile === TerrainType.SOLID) {
              localVisited.add(nidx)
              queue.push([nx, ny])
            }
          }
        }

        for (const { x, y } of component) globalVisited.add(y * this.width + x)
        if (!anchored) for (const tile of component) islandTiles.push(tile)
      }
    }

    return islandTiles
  }

  _appyEffectTiles: TileEffectResult[] = []

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
    // SOLID creation: geometric circle through EMPTY tiles only — water is a hard wall.
    // Island detection fires onIslandDetected for any tiles not connected to permanent
    // terrain or world bounds so they can be converted to sand.
    if (mode === FireMode.CREATE) {
      let tiles: Tile[] = []
      this.getCircle(tileX, tileY, tileRadius, (x, y) => {
        const value = this.getTile(x, y)
        if (value !== TerrainType.EMPTY) return
        if (
          x > px - PLAYER_RADIUS_X + velLeft && x < px + PLAYER_RADIUS_X + velRight &&
          y > py - PLAYER_RADIUS_Y + velUp && y < py + PLAYER_RADIUS_Y + velDown
        ) return
        tiles.push({ x, y })
      })

      if (tilesToModify < tiles.length) tiles = truncateArrayRandomly(tiles, tilesToModify)
      if (!tiles.length) return tiles

      const newValue = TerrainType.SOLID
      const startTime = this.scene.time.now
      for (const { x, y } of tiles) {
        this.scene.tilemapRenderer.addEffect(x, y, newValue, startTime)
        this.setTile(x, y, newValue)
      }

      this.chunkManager.computeAnchored()
      const islands = this.findIslandTiles(tiles)
      if (islands.length) this.onIslandDetected?.(islands)

      return tiles
    } else if (mode === FireMode.DESTROY) {
      const newValue = TerrainType.EMPTY
      // After removing tiles, check if any adjacent solid became disconnected.
      let tiles: Tile[] = []
      this.getCircle(tileX, tileY, tileRadius, (x, y) => {
        const value = this.getTile(x, y)
        if (value === TerrainType.PERMANENT) return
        if (newValue === value) return
        if (this.isFluid(value)) return
        tiles.push({ x, y })
      })

      if (tilesToModify < tiles.length) tiles = truncateArrayRandomly(tiles, tilesToModify)
      if (!tiles.length) return tiles

      const startTime = this.scene.time.now
      for (const { x, y } of tiles) {
        this.scene.tilemapRenderer.addEffect(x, y, newValue, startTime)
        this.setTile(x, y, newValue)
      }

      const newIslands = this.findNewlyDisconnectedByDestruction(tiles)
      if (newIslands.length) this.onIslandDetected?.(newIslands)

      return tiles
    } else if (mode === FireMode.MELT) {
      let tiles = this._appyEffectTiles
      this.getCircle(tileX, tileY, tileRadius, (x, y) => {
        const value = this.getTile(x, y)
        let newValue: TerrainType

        if (value === TerrainType.SOLID) newValue = TerrainType.SAND
        else if (value === TerrainType.SAND_SETTLED) newValue = TerrainType.WATER
        else if (value === TerrainType.SAND) newValue = TerrainType.WATER
        else return

        tiles.push({ x, y, newValue })
      })

      if (tilesToModify < tiles.length) tiles = truncateArrayRandomly(tiles, tilesToModify)
      if (!tiles.length) return tiles

      const startTime = this.scene.time.now
      for (const { x, y, newValue } of tiles) {
        this.scene.tilemapRenderer.addEffect(x, y, newValue, startTime)
        this.setTile(x, y, newValue)
      }
      this.scene.sandBridge.activateTiles(tiles)

      const newIslands = this.findNewlyDisconnectedByDestruction(tiles)
      if (newIslands.length) this.onIslandDetected?.(newIslands)

      return tiles
    } else if (mode === FireMode.SOLIDIFY) {
      let tiles = this._appyEffectTiles
      this.getCircle(tileX, tileY, tileRadius, (x, y) => {
        const value = this.getTile(x, y)
        let newValue: TerrainType

        if (value === TerrainType.WATER) newValue = TerrainType.SAND
        else if (value === TerrainType.SAND_SETTLED) newValue = TerrainType.SOLID
        else if (value === TerrainType.SAND) newValue = TerrainType.SOLID
        else return

        tiles.push({ x, y, newValue })
      })

      if (tilesToModify < tiles.length) tiles = truncateArrayRandomly(tiles, tilesToModify)
      if (!tiles.length) return tiles

      const startTime = this.scene.time.now
      for (const { x, y, newValue } of tiles) {
        this.scene.tilemapRenderer.addEffect(x, y, newValue, startTime)
        this.setTile(x, y, newValue)
      }
      this.scene.sandBridge.activateTiles(tiles)

      this.chunkManager.computeAnchored()
      const islands = this.findIslandTiles(tiles)
      if (islands.length) this.onIslandDetected?.(islands)

      return tiles
    }

    return []
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
    this.onTileEmpty = undefined
    this.onIslandDetected = undefined
    // @ts-expect-error: destroy
    this.tiles = null
    // @ts-expect-error: destroy
    this.sab = null
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
