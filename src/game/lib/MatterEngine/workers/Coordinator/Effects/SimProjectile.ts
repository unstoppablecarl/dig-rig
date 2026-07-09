/// <reference lib="webworker" />
import { FILL_MAX } from '../../../../Matter/_Liquid.constants.ts'
import { EMPTY, FIRE, getOwner, matterType, MatterType, SupportType } from '../../../../Matter/_Matter.types.ts'
import {
  convertsToCollisionBody, doesSettle,
  getReserveDestroyAmount,
  getSupportType,
  isLiquid,
  RESERVED_DESTROY_CHARGE,
} from '../../../../Matter/matter.ts'
import type { MatterTankId } from '../../../../Matter/Tank/_MatterTank.types.ts'
import type { PlayerBounds } from '../../../data/PlayerBoundsData.ts'
import type { MatterSim } from '../../MatterSim/MatterSim.ts'
import type { PhysicsCollapse } from '../PhysicsCollapse.ts'
import type { SimMatterTanks } from '../SimMatterTanks.ts'

export type ProjectileEffectResult = { x: number, y: number, newValue: MatterType }

export type EffectResult = {
  tiles: ProjectileEffectResult[]
  structuralDirty: boolean
  // Net change to the liquid fill domain (fill units): negative = destroyed, positive = created.
  liquidDomainDelta: number
  // Net change to the solid tile-count domain (tile units, tank not included).
  // Callers that also perform a tank credit/debit must add that separately.
  solidDomainDelta: number
  // Count of tiles whose previous type was liquid (used by DESTROY to split tank credits).
  prevLiquidTiles: number
}

export abstract class SimProjectile {
  protected readonly width: number
  protected readonly height: number

  constructor(
    protected readonly sim: MatterSim,
    protected readonly physics: PhysicsCollapse,
    protected readonly matterTanks: SimMatterTanks,
  ) {
    this.width = sim.width
    this.height = sim.height
  }

  protected abstract convertTile(existing: MatterType, createType: MatterType, ownerId: MatterTankId): MatterType | null

  protected shouldSkipTile(_x: number, _y: number, _playerBounds: PlayerBounds, _typeDoesSettle: boolean): boolean {
    return false
  }

  protected abstract postApply(
    candidates: ProjectileEffectResult[],
    createType: MatterType,
    activeSet: Set<number>,
    dirtyChunks: Set<number>,
  ): void

  apply(
    createType: MatterType,
    tileX: number,
    tileY: number,
    tileRadius: number,
    innerRadius: number,
    ownerId: MatterTankId,
    budget: number,
    playerBounds: PlayerBounds,
    activeSet: Set<number>,
    dirtyChunks: Set<number>,
  ): EffectResult {
    const { width, height } = this
    const tiles = this.sim.tiles
    const candidates: ProjectileEffectResult[] = []
    const r2 = tileRadius * tileRadius
    const ir2 = innerRadius * innerRadius
    const minY = Math.max(0, Math.floor(tileY - tileRadius))
    const maxY = Math.min(height - 1, Math.ceil(tileY + tileRadius))
    const typeDoesSettle = doesSettle(createType)

    for (let y = minY; y <= maxY; y++) {
      const dy = y - tileY
      const dy2 = dy * dy
      if (dy2 > r2) continue
      const outerDx = Math.sqrt(r2 - dy2)
      const xMin = Math.max(0, Math.ceil(tileX - outerDx))
      const xMax = Math.min(width - 1, Math.floor(tileX + outerDx))

      if (innerRadius > 0 && dy2 <= ir2) {
        const innerDx = Math.sqrt(ir2 - dy2)
        const xSkipStart = Math.ceil(tileX - innerDx)
        const xSkipEnd = Math.floor(tileX + innerDx)
        for (let x = xMin; x < xSkipStart; x++) this._tryCandidate(candidates, tiles, x, y, createType, ownerId, playerBounds,typeDoesSettle)
        for (let x = xSkipEnd + 1; x <= xMax; x++) this._tryCandidate(candidates, tiles, x, y, createType, ownerId, playerBounds,typeDoesSettle)
      } else {
        for (let x = xMin; x <= xMax; x++) this._tryCandidate(candidates, tiles, x, y, createType, ownerId, playerBounds,typeDoesSettle)
      }
    }

    if (budget < candidates.length) {
      candidates.sort((a, b) =>
        ((a.x - tileX) ** 2 + (a.y - tileY) ** 2) - ((b.x - tileX) ** 2 + (b.y - tileY) ** 2),
      )
      candidates.length = budget
    }

    return this._writeCandidates(candidates, createType, activeSet, dirtyChunks)
  }

  // Shared by the radius scan above and the BFS-based flood fill variants — converts
  // already-gathered candidates to their newValue and runs the mode-specific postApply.
  protected _writeCandidates(
    candidates: ProjectileEffectResult[],
    createType: MatterType,
    activeSet: Set<number>,
    dirtyChunks: Set<number>,
  ): EffectResult {
    if (candidates.length === 0) return {
      tiles: candidates,
      structuralDirty: false,
      liquidDomainDelta: 0,
      solidDomainDelta: 0,
      prevLiquidTiles: 0,
    }

    const { width } = this
    const tiles = this.sim.tiles

    let structuralDirty = false
    let liquidDomainDelta = 0
    let solidDomainDelta = 0
    let prevLiquidTiles = 0
    for (const { x, y, newValue } of candidates) {
      const idx = y * width + x
      const prevRaw = tiles[idx]
      if (!structuralDirty && (getSupportType(prevRaw) >= SupportType.STRUCTURAL || getSupportType(newValue) >= SupportType.STRUCTURAL)) {
        structuralDirty = true
      }
      const prevType = matterType(prevRaw)
      const newType = matterType(newValue)
      if (prevType !== newType && RESERVED_DESTROY_CHARGE.has(prevType)) {
        this.matterTanks.releaseDestroyCharge(getOwner(prevRaw), getReserveDestroyAmount(prevType), 'external-overwrite')
      }
      // Track liquid domain change before modifying fill.
      if (isLiquid(prevType)) {
        liquidDomainDelta -= this.sim.fill[idx]
        prevLiquidTiles++
      }
      if (isLiquid(newType)) {
        liquidDomainDelta += FILL_MAX
      }
      // Track raw solid tile-count change (callers add tank adjustments separately).
      const prevSolid = prevType !== EMPTY && prevType !== FIRE && !isLiquid(prevType)
      const newSolid = newType !== EMPTY && newType !== FIRE && !isLiquid(newType)
      if (prevSolid && !newSolid) solidDomainDelta -= 1
      else if (!prevSolid && newSolid) solidDomainDelta += 1
      // Only bump collGen if the write actually changes whether this tile
      // contributes to terrain collision — otherwise it's a wasted rebuild.
      const wasCollidable = convertsToCollisionBody(prevRaw)
      tiles[idx] = newValue
      if (isLiquid(newType)) {
        this.sim.fill[idx] = FILL_MAX
      } else {
        this.sim.fill[idx] = 0
      }
      const isCollidable = convertsToCollisionBody(newValue)
      if (wasCollidable !== isCollidable) {
        this.sim.markDirty(x, y)
      } else {
        this.sim.markRenderDirty(x, y)
      }
      dirtyChunks.add(this.physics.chunkIdxForTile(idx))
      if (newValue === EMPTY) this.sim.reactivateAround(x, y, activeSet)
    }

    this.postApply(candidates, createType, activeSet, dirtyChunks)

    return {
      tiles: candidates,
      structuralDirty,
      liquidDomainDelta,
      solidDomainDelta,
      prevLiquidTiles,
    }
  }

  private _tryCandidate(
    out: ProjectileEffectResult[],
    tiles: Uint32Array,
    x: number,
    y: number,
    createType: MatterType,
    ownerId: MatterTankId,
    playerBounds: PlayerBounds,
    typeDoesSettle: boolean,
  ) {
    if (this.shouldSkipTile(x, y, playerBounds,typeDoesSettle)) return
    const idx = y * this.width + x
    const existing = matterType(tiles[idx])
    const newValue = this.convertTile(existing, createType, ownerId)
    if (newValue !== null) out.push({ x, y, newValue })
  }
}
