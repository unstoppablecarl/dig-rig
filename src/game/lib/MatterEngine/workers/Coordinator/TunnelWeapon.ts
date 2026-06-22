/// <reference lib="webworker" />
import { EMPTY, matterType, SOLID } from '../../../Matter/_Matter.types.ts'
import type { MatterTankId } from '../../../Matter/Tank/_MatterTank.types.ts'
import { PLAYER_MATTER_TANK_ID } from '../../../Matter/Tank/_MatterTank.types.ts'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import type { PlayerBoundsDataType } from '../../data/PlayerBoundsData.ts'
import type { TunnelWeaponDataType } from '../../data/TunnelWeaponData.ts'
import type { VFXParticleData } from '../../data/VFXParticleData.ts'
import type { VFXTileEffectData } from '../../data/VFXTileEffectData.ts'
import type { Effects } from './Effects.ts'

type Tile = { x: number; y: number }
type RestoreRecord = { cx: number; cy: number; radius: number; remaining: Tile[] }
const TILE_SAFE_RADIUS = 25
const TILE_SAFE_RSQ = TILE_SAFE_RADIUS * TILE_SAFE_RADIUS
const DUMMY_OWNER = 0 as unknown as MatterTankId
const DESTROY_BUDGET = 10000

export class TunnelWeapon {
  private _restoreQueue: RestoreRecord[] = []
  private _pendingRestore = 0
  private _restoreVisited = new Set<number>()
  private _restoreResultTiles: Tile[] = []
  private _restoreResultIndices: number[] = []

  constructor(
    private readonly effects: Effects,
    private readonly data: TunnelWeaponDataType,
    private readonly playerBoundsData: PlayerBoundsDataType,
    private readonly vfxParticleData: VFXParticleData,
    private readonly vfxTileEffectData: VFXTileEffectData,
    private readonly tiles: Uint32Array,
    private readonly width: number,
    private readonly height: number,
  ) {
  }

  hasWork(): boolean {
    return this.data.destroyActive !== 0 || this._pendingRestore > 0 || this._restoreQueue.length > 0
  }

  step(activeSet: Set<number>, dirtyChunks: Set<number>): boolean {
    const structuralDirty = this._stepDestroy(activeSet, dirtyChunks)
    const restoreTiles = this._stepRestore(activeSet, dirtyChunks)
    if (restoreTiles.length > 0) {
      this.vfxTileEffectData.writeFireModeTiles(restoreTiles, FireMode.CREATE)
    }
    return structuralDirty
  }

  private _stepDestroy(activeSet: Set<number>, dirtyChunks: Set<number>): boolean {
    const b = this.data
    if (b.destroyActive === 0) return false

    const cx = b.destroyX
    const cy = b.destroyY
    const radius = b.destroyRadius
    const { tiles, structuralDirty } = this.effects.processTunnelDestroy(
      Math.round(cx), Math.round(cy), radius, DESTROY_BUDGET, DUMMY_OWNER,
      activeSet, dirtyChunks,
    )
    if (tiles.length > 0) {
      this.vfxParticleData.writeTiles(tiles, PLAYER_MATTER_TANK_ID)
      this._restoreQueue.push({ cx, cy, radius, remaining: tiles.map(t => ({ x: t.x, y: t.y })) })
      this._pendingRestore += tiles.length
    }
    return structuralDirty
  }

  private _stepRestore(activeSet: Set<number>, dirtyChunks: Set<number>): Tile[] {
    if (this._pendingRestore <= 0 && this._restoreQueue.length === 0) return []

    const pb = this.playerBoundsData
    const px = (pb.left + pb.right) / 2
    const py = (pb.top + pb.bottom) / 2

    const b = this.data
    const dpx = b.destroyActive !== 0 ? b.destroyX : NaN
    const dpy = b.destroyActive !== 0 ? b.destroyY : NaN
    const dpR2 = b.destroyRadius * b.destroyRadius

    const available = this._pendingRestore
    if (this._restoreQueue.length === 0 && available <= 0) return []

    const visited = this._restoreVisited
    visited.clear()
    const resultTiles = this._restoreResultTiles
    const resultIndices = this._restoreResultIndices
    resultTiles.length = 0
    resultIndices.length = 0

    let writeIdx = 0
    let outOfMatter = available <= 0

    for (let i = 0; i < this._restoreQueue.length; i++) {
      const record = this._restoreQueue[i]

      if (outOfMatter) {
        this._restoreQueue[writeIdx++] = record
        continue
      }

      const dx = record.cx - px
      const dy = record.cy - py
      const allSafe = dx * dx + dy * dy > (record.radius + TILE_SAFE_RADIUS) ** 2

      if (!allSafe && record.remaining.length > 0) {
        const ft = record.remaining[0]
        const ftdx = ft.x - px, ftdy = ft.y - py
        const ftddx = ft.x - dpx, ftddy = ft.y - dpy
        if ((ftdx * ftdx + ftdy * ftdy <= TILE_SAFE_RSQ) ||
          (ftddx * ftddx + ftddy * ftddy <= dpR2)) {
          this._restoreQueue[writeIdx++] = record
          continue
        }
      }

      const obstructed = this._processRecord(
        record, resultTiles, resultIndices, visited, available,
        px, py, allSafe, dpx, dpy, dpR2,
      )

      if (obstructed > 0 && resultTiles.length < available) {
        const cx = Math.round(record.cx)
        const cy = Math.round(record.cy)
        const targetLen = Math.min(resultTiles.length + obstructed, available)
        const maxRadius = record.radius * 4
        const scanCircle = (adjOnly: boolean) => {
          let searchRadius = record.radius
          while (resultTiles.length < targetLen && searchRadius <= maxRadius) {
            this._getCircle(cx, cy, searchRadius, (x, y) => {
              if (matterType(this.tiles[y * this.width + x]) !== EMPTY) return false
              if (adjOnly && !this._isAdjacentToSolid(x, y)) return false
              const key = y * this.width + x
              if (visited.has(key)) return false
              if (!allSafe) {
                const fdx = x - px, fdy = y - py
                if (fdx * fdx + fdy * fdy <= TILE_SAFE_RSQ) return false
              }
              const ddx = x - dpx, ddy = y - dpy
              if (ddx * ddx + ddy * ddy <= dpR2) return false
              visited.add(key)
              resultTiles.push({ x, y })
              resultIndices.push(key)
              return resultTiles.length >= targetLen
            })
            searchRadius = Math.round(searchRadius * 1.5)
          }
        }
        scanCircle(true)
        if (resultTiles.length < targetLen) scanCircle(false)
      }

      if (resultTiles.length >= available) outOfMatter = true

      if (record.remaining.length > 0) {
        this._restoreQueue[writeIdx++] = record
      }
    }
    this._restoreQueue.length = writeIdx

    if (!outOfMatter && resultTiles.length < available && this._restoreQueue.length === 0) {
      const cx = Math.round(px)
      const cy = Math.round(py)
      const scanGlobal = (adjOnly: boolean) => {
        let searchRadius = TILE_SAFE_RADIUS + 1
        while (resultTiles.length < available && searchRadius <= 200) {
          this._getCircle(cx, cy, searchRadius, (x, y) => {
            if (matterType(this.tiles[y * this.width + x]) !== EMPTY) return false
            if (adjOnly && !this._isAdjacentToSolid(x, y)) return false
            const key = y * this.width + x
            if (visited.has(key)) return false
            const fdx = x - px, fdy = y - py
            if (fdx * fdx + fdy * fdy <= TILE_SAFE_RSQ) return false
            const ddx = x - dpx, ddy = y - dpy
            if (ddx * ddx + ddy * ddy <= dpR2) return false
            visited.add(key)
            resultTiles.push({ x, y })
            resultIndices.push(key)
            return resultTiles.length >= available
          })
          searchRadius = Math.round(searchRadius * 1.5)
        }
      }
      scanGlobal(true)
      if (resultTiles.length < available) scanGlobal(false)
    }

    if (resultIndices.length > 0) {
      this.effects.applyTileWrites(
        [{ indices: resultIndices, tile: SOLID, reactivateAround: false }],
        activeSet, dirtyChunks,
      )
      this._pendingRestore -= resultIndices.length
    }

    return resultTiles.slice()
  }

  private _processRecord(
    record: RestoreRecord,
    resultTiles: Tile[],
    resultIndices: number[],
    visited: Set<number>,
    available: number,
    px: number,
    py: number,
    allSafe: boolean,
    dpx: number,
    dpy: number,
    dpR2: number,
  ): number {
    const remaining = record.remaining
    const w = this.width
    let writeIdx = 0
    let obstructed = 0
    let limitHit = false

    for (let i = 0; i < remaining.length; i++) {
      const tile = remaining[i]

      if (limitHit) {
        remaining[writeIdx++] = tile
        continue
      }

      if (!allSafe) {
        const tdx = tile.x - px
        const tdy = tile.y - py
        if (tdx * tdx + tdy * tdy <= TILE_SAFE_RSQ) {
          remaining[writeIdx++] = tile
          continue
        }
      }

      const ddx = tile.x - dpx
      const ddy = tile.y - dpy
      if (ddx * ddx + ddy * ddy <= dpR2) {
        remaining[writeIdx++] = tile
        continue
      }

      if (resultTiles.length >= available) {
        limitHit = true
        remaining[writeIdx++] = tile
        continue
      }

      if (matterType(this.tiles[tile.y * w + tile.x]) !== EMPTY) {
        obstructed++
        continue
      }

      const key = tile.y * w + tile.x
      if (visited.has(key)) continue
      visited.add(key)
      resultTiles.push({ x: tile.x, y: tile.y })
      resultIndices.push(key)
    }

    remaining.length = writeIdx
    return obstructed
  }

  private _isAdjacentToSolid(x: number, y: number): boolean {
    const w = this.width
    const h = this.height
    const tiles = this.tiles
    const check = (tx: number, ty: number) =>
      tx >= 0 && tx < w && ty >= 0 && ty < h && matterType(tiles[ty * w + tx]) !== EMPTY
    return check(x - 1, y) || check(x + 1, y) || check(x, y - 1) || check(x, y + 1)
  }

  private _getCircle(cx: number, cy: number, radius: number, fn: (x: number, y: number) => boolean): void {
    const { width, height } = this
    const r2 = radius * radius
    const minY = Math.max(0, cy - radius | 0)
    const maxY = Math.min(height - 1, cy + radius | 0)
    outer: for (let y = minY; y <= maxY; y++) {
      const dy = y - cy
      if (dy * dy > r2) continue
      const dxMax = Math.sqrt(r2 - dy * dy)
      const minX = Math.max(0, cx - dxMax | 0)
      const maxX = Math.min(width - 1, cx + dxMax | 0)
      for (let x = minX; x <= maxX; x++) {
        if (fn(x, y)) break outer
      }
    }
  }

}
