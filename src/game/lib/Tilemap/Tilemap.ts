import { Geom } from 'phaser'
import { type Color32, type PixelData, unpackAlpha } from 'pixel-data-js'
import { getCollisionSteps } from '../../helpers/_helpers.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Position } from '../../types.ts'
import { isSettled, MatterType, matterType, MatterTypeSet } from '../Matter/_Matter-types.ts'
import { COLLIDES_WHEN_SETTLED } from '../Matter/elements.ts'
import { ChunkManager } from './ChunkManager.ts'
import Rectangle = Geom.Rectangle

export type Tile = { x: number, y: number }

const BFS_DX = [-1, 1, 0, 0]
const BFS_DY = [0, 0, -1, 1]

export class Tilemap extends SceneBound {
  private readonly sab: SharedArrayBuffer
  readonly tiles: Uint32Array<SharedArrayBuffer>
  public chunkManager: ChunkManager
  public onTileEmpty?: (tx: number, ty: number) => void
  public onIslandDetected?: (tiles: Tile[]) => void
  public onActivateTiles?: (tiles: Tile[]) => void

  private matter = 0

  readonly diagonalDistance: number

  // Pre-allocated BFS buffers — eliminates Set + per-tile object allocations in the hot path
  private readonly _bfsVisited: Uint8Array   // 0=unvisited, 1=in-component, 2=globally done
  private readonly _bfsQueue: Int32Array     // flat tile index queue
  private readonly _bfsComp: Int32Array      // component tile indices for this BFS pass

  constructor(
    readonly scene: GameLevel,
    readonly width: number,
    readonly height: number,
  ) {
    super(scene)
    this.sab = new SharedArrayBuffer(width * height * Uint32Array.BYTES_PER_ELEMENT)
    this.tiles = new Uint32Array(this.sab)

    this.diagonalDistance = Math.hypot(width, height)

    this.chunkManager = new ChunkManager(scene, width, height)

    const n = width * height
    this._bfsVisited = new Uint8Array(n)
    this._bfsQueue = new Int32Array(n)
    this._bfsComp = new Int32Array(n)
  }

  get tilesBuffer(): SharedArrayBuffer {
    return this.sab
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
    const prevType = matterType(prev)
    this.tiles[id] = value
    this.chunkManager.setDirty(x, y, prev, value)
    if (prevType === MatterType.SOLID && value !== MatterType.SOLID) this.matter--
    if (prevType !== MatterType.SOLID && value === MatterType.SOLID) this.matter++
    if (value === MatterType.EMPTY) this.onTileEmpty?.(x, y)
    return true
  }

  // Returns the raw tile value, which may include SETTLED_FLAG (0x80) in bit 7.
  // Use `value & TYPE_MASK` to get the base MatterType for comparisons.
  public getTile(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return MatterType.PERMANENT
    return this.tiles[y * this.width + x]
  }

  public isSolid(x: number, y: number) {
    const raw = this.getTile(Math.floor(x), Math.floor(y))
    const type = matterType(raw)
    if (type === MatterType.SOLID || type === MatterType.PERMANENT) return true
    if (isSettled(raw)) {
      return COLLIDES_WHEN_SETTLED.has(type)
    }
    return false
  }

  public getTileFromWorld(worldX: number, worldY: number): number {
    return this.getTile(Math.round(worldX), Math.round(worldY))
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
    return matterType(this.getTile(tileX, tileY)) === terrainType
  }

  public checkCircleCollision(
    tileX: number,
    tileY: number,
    tileRadius: number,
    terrainType: MatterType,
  ) {
    return this.getCircle(tileX, tileY, tileRadius, (x, y) => {
      return matterType(this.getTile(x, y)) === terrainType
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
        if (nTile === MatterType.PERMANENT) return []
        if (nTile !== MatterType.SOLID) continue
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
        if (nTile === MatterType.PERMANENT) {
          anchored = true
          break outer
        }
        if (nTile === MatterType.SOLID) {
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
  // Only MatterType.SOLID forms structural connections — SAND, SAND_SETTLED, and
  // WATER are transparent to this BFS (neither a connection nor a blocking wall).
  // No BFS cap: connected terrain always finds PERMANENT in a small number of hops
  // because PERMANENT tiles exist at the world boundary which is never far from
  // any solid tile.  Genuine islands exhaust their component and are detected
  // regardless of size.
  public findNewlyDisconnectedByDestruction(destroyedTiles: Tile[]): Tile[] {
    const { width, height, tiles, _bfsVisited: vis, _bfsQueue: queue, _bfsComp: comp } = this
    vis.fill(0)

    const islandTiles: Tile[] = []

    for (const { x: dx, y: dy } of destroyedTiles) {
      for (let d = 0; d < 4; d++) {
        const sx = dx + BFS_DX[d], sy = dy + BFS_DY[d]
        if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue
        const sidx = sy * width + sx
        if (vis[sidx] !== 0) continue
        if (tiles[sidx] !== MatterType.SOLID) continue

        let head = 0, tail = 0, compLen = 0
        let anchored = false

        vis[sidx] = 1
        queue[tail++] = sidx
        comp[compLen++] = sidx

        bfs: while (head < tail) {
          const cidx = queue[head++]
          const cx = cidx % width
          const cy = (cidx / width) | 0

          for (let d2 = 0; d2 < 4; d2++) {
            const nx = cx + BFS_DX[d2], ny = cy + BFS_DY[d2]
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
              anchored = true
              break bfs
            }
            const nidx = ny * width + nx
            if (vis[nidx] !== 0) continue
            const nt = tiles[nidx]
            if (nt === MatterType.PERMANENT) {
              anchored = true
              break bfs
            }
            if (nt === MatterType.SOLID) {
              vis[nidx] = 1
              queue[tail++] = nidx
              comp[compLen++] = nidx
            }
          }
        }

        for (let k = 0; k < compLen; k++) vis[comp[k]] = 2
        if (!anchored) {
          for (let k = 0; k < compLen; k++) {
            const idx = comp[k]
            islandTiles.push({ x: idx % width, y: (idx / width) | 0 })
          }
        }
      }
    }

    return islandTiles
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

      const collision = matterType(this.getTileFromWorld(stepX, stepY)) !== MatterType.EMPTY
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
    this.onActivateTiles = undefined
    // @ts-expect-error: destroy
    this.tiles = null
    // @ts-expect-error: destroy
    this.sab = null
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
    types: MatterTypeSet,
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

  outOfBounds(x: number, y: number): boolean {
    return x < 0 || x >= this.width || y < 0 || y >= this.height
  }
}
