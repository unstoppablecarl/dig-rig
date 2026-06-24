/// <reference lib="webworker" />
import { EMPTY, getOwner, matterType, MatterType, SupportType } from '../../../../Matter/_Matter.types.ts'
import { getReserveDestroyAmount, getSupportType, RESERVED_DESTROY_CHARGE } from '../../../../Matter/matter.ts'
import type { MatterTankId } from '../../../../Matter/Tank/_MatterTank.types.ts'
import type { PlayerBounds } from '../../../data/PlayerBoundsData.ts'
import type { MatterSim } from '../../MatterSim/MatterSim.ts'
import type { Physics } from '../Physics.ts'
import type { SimMatterTanks } from '../SimMatterTanks.ts'

export type ProjectileEffectResult = { x: number, y: number, newValue: MatterType }
export type EffectResult = { tiles: ProjectileEffectResult[], structuralDirty: boolean }

export abstract class SimProjectile {
  constructor(
    protected readonly sim: MatterSim,
    protected readonly physics: Physics,
    protected readonly matterTanks: SimMatterTanks,
    protected readonly width: number,
    protected readonly height: number,
  ) {
  }

  protected abstract convertTile(existing: MatterType, createType: MatterType, ownerId: MatterTankId): MatterType | null

  protected shouldSkipTile(_x: number, _y: number, _playerBounds: PlayerBounds): boolean {
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
        for (let x = xMin; x < xSkipStart; x++) this._tryCandidate(candidates, tiles, x, y, createType, ownerId, playerBounds)
        for (let x = xSkipEnd + 1; x <= xMax; x++) this._tryCandidate(candidates, tiles, x, y, createType, ownerId, playerBounds)
      } else {
        for (let x = xMin; x <= xMax; x++) this._tryCandidate(candidates, tiles, x, y, createType, ownerId, playerBounds)
      }
    }

    if (budget < candidates.length) {
      candidates.sort((a, b) =>
        ((a.x - tileX) ** 2 + (a.y - tileY) ** 2) - ((b.x - tileX) ** 2 + (b.y - tileY) ** 2),
      )
      candidates.length = budget
    }

    if (candidates.length === 0) return { tiles: candidates, structuralDirty: false }

    let structuralDirty = false
    for (const { x, y, newValue } of candidates) {
      const idx = y * width + x
      const prevRaw = tiles[idx]
      if (!structuralDirty && (getSupportType(prevRaw) >= SupportType.STRUCTURAL || getSupportType(newValue) >= SupportType.STRUCTURAL)) {
        structuralDirty = true
      }
      const prevType = matterType(prevRaw)
      if (prevType !== matterType(newValue) && RESERVED_DESTROY_CHARGE.has(prevType)) {
        this.matterTanks.releaseDestroyCharge(getOwner(prevRaw), getReserveDestroyAmount(prevType), 'external-overwrite')
      }
      tiles[idx] = newValue
      this.sim.markDirty(x, y)
      dirtyChunks.add(this.physics.chunkIdxForTile(idx))
      if (newValue === EMPTY) this.sim.reactivateAround(x, y, activeSet)
    }

    this.postApply(candidates, createType, activeSet, dirtyChunks)

    return {
      tiles: candidates,
      structuralDirty,
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
  ) {
    if (this.shouldSkipTile(x, y, playerBounds)) return
    const idx = y * this.width + x
    const existing = matterType(tiles[idx])
    const newValue = this.convertTile(existing, createType, ownerId)
    if (newValue !== null) out.push({ x, y, newValue })
  }
}
