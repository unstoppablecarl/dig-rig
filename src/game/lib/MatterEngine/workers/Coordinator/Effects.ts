/// <reference lib="webworker" />
import { EMPTY, MatterType, matterType, SOLID, SupportType } from '../../../Matter/_Matter.types.ts'
import { convertsToCollisionBody, doesSettle, getSupportType } from '../../../Matter/matter.ts'
import { type MatterTankId, NO_MATTER_TANK_ID } from '../../../Matter/Tank/_MatterTank.types.ts'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import { EMPTY_PLAYER_BOUNDS, type PlayerBounds, type PlayerBoundsDataType } from '../../data/PlayerBoundsData.ts'
import { type ProjectileManagerData, ProjectileShape } from '../../data/ProjectileManagerData.ts'
import type { TileSet } from '../../../Matter/data/SparseTileSet.ts'
import type { CoordinatorInMsgBrushEraseMatter } from '../Coordinator.types.ts'
import type { MatterSim } from '../MatterSim/MatterSim.ts'
import { FloodFillCreate } from './Effects/FloodFillCreate.ts'
import { FloodFillDestroy } from './Effects/FloodFillDestroy.ts'
import { ProjectileCreate } from './Effects/ProjectileCreate.ts'
import { ProjectileDestroy } from './Effects/ProjectileDestroy.ts'
import { ProjectileMelt } from './Effects/ProjectileMelt.ts'
import { ProjectileSolidify } from './Effects/ProjectileSolidify.ts'
import type { EffectResult, SimProjectile } from './Effects/SimProjectile.ts'
import { PhysicsCollapse } from './PhysicsCollapse.ts'
import type { SimMatterTanks } from './SimMatterTanks.ts'

export type WriteEntry = {
  indices: number[]
  tile: number
  reactivateAround: boolean
}

const EMPTY_EFFECT_RESULT: EffectResult = {
  tiles: [],
  structuralDirty: false,
  liquidDomainDelta: 0,
  solidDomainDelta: 0,
  prevLiquidTiles: 0,
}

function mergeEffectResults(a: EffectResult, b: EffectResult): EffectResult {
  return {
    tiles: a.tiles.length === 0 ? b.tiles : b.tiles.length === 0 ? a.tiles : a.tiles.concat(b.tiles),
    structuralDirty: a.structuralDirty || b.structuralDirty,
    liquidDomainDelta: a.liquidDomainDelta + b.liquidDomainDelta,
    solidDomainDelta: a.solidDomainDelta + b.solidDomainDelta,
    prevLiquidTiles: a.prevLiquidTiles + b.prevLiquidTiles,
  }
}

export class Effects {
  private readonly createProjectile: ProjectileCreate
  private readonly destroyProjectile: ProjectileDestroy
  private readonly meltProjectile: ProjectileMelt
  private readonly solidifyProjectile: ProjectileSolidify
  private readonly floodFillCreate: FloodFillCreate
  private readonly floodFillDestroy: FloodFillDestroy
  readonly width: number
  readonly height: number

  constructor(
    private readonly sim: MatterSim,
    private readonly physics: PhysicsCollapse,
    matterTanks: SimMatterTanks,
    private readonly playerBoundsData: PlayerBoundsDataType,
  ) {
    this.createProjectile = new ProjectileCreate(sim, physics, matterTanks)
    this.destroyProjectile = new ProjectileDestroy(sim, physics, matterTanks)
    this.meltProjectile = new ProjectileMelt(sim, physics, matterTanks)
    this.solidifyProjectile = new ProjectileSolidify(sim, physics, matterTanks)
    this.floodFillCreate = new FloodFillCreate(sim, physics, matterTanks)
    this.floodFillDestroy = new FloodFillDestroy(sim, physics, matterTanks)
    this.width = sim.width
    this.height = sim.height
  }

  applyTileWrites(
    writes: WriteEntry[],
    activeSet: TileSet,
    dirtyChunks: Set<number>,
  ): boolean {
    const tiles = this.sim.tiles
    const w = this.width
    let structuralDirty = false
    for (const { indices, tile, reactivateAround } of writes) {
      const t = matterType(tile)
      const shouldActivate = t !== EMPTY && doesSettle(t)

      for (const idx of indices) {
        const x = idx % w
        const y = idx / w | 0
        if (!structuralDirty && (getSupportType(tiles[idx]) >= SupportType.STRUCTURAL || getSupportType(tile) >= SupportType.STRUCTURAL)) {
          structuralDirty = true
        }
        // Only bump collGen if the write actually changes whether this tile
        // contributes to terrain collision (e.g. liquid fills from FloodFillCreate
        // never do) — otherwise it's a wasted terrain-body rebuild.
        const wasCollidable = convertsToCollisionBody(tiles[idx])
        tiles[idx] = tile
        const isCollidable = convertsToCollisionBody(tile)
        if (wasCollidable !== isCollidable) {
          this.sim.markDirty(x, y)
        } else {
          this.sim.markRenderDirty(x, y)
        }
        dirtyChunks.add(this.physics.chunkIdxForTile(idx))
        if (reactivateAround) {
          this.sim.reactivateAround(x, y, activeSet)
        }
        if (shouldActivate) {
          this.sim.activate(idx, activeSet)
        }
      }

      if (getSupportType(tile) >= SupportType.STRUCTURAL) {
        const placed = indices.map(idx => ({ x: idx % w, y: idx / w | 0 }))
        const islands = this.physics.findIslandTiles(placed)
        if (islands.length > 0) this.physics.collapseIslands(islands, activeSet, dirtyChunks)
      }
    }

    return structuralDirty
  }

  applyBrushErase(
    req: CoordinatorInMsgBrushEraseMatter,
    activeSet: TileSet,
    dirtyChunks: Set<number>,
  ): EffectResult {
    return this.destroyProjectile.apply(
      SOLID,
      req.tx,
      req.ty,
      req.radius,
      0,
      req.ownerId,
      Number.MAX_SAFE_INTEGER,
      EMPTY_PLAYER_BOUNDS,
      activeSet,
      dirtyChunks,
    )
  }

  // Applies a circle-shaped projectile effect swept along the segment from
  // (fromX, fromY) to (toX, toY) instead of sampling a single point at the
  // end. The main thread writes tileX/tileY every render frame independent
  // of the coordinator's tick rate — under sim lag, (fromX, fromY) (where
  // this slot was last actually processed) can be many tiles away from the
  // current position, and a single circle at the endpoint would silently
  // skip everything in between. Sample points are spaced roughly one radius
  // apart so consecutive circles overlap and leave no gap, however large the
  // jump. Budget is threaded through and decremented across sample points
  // (not reset per point), so a beam can't overspend its remaining charge
  // just because it had a lot of ground to cover this tick.
  private _sweepApply(
    projectile: SimProjectile,
    createType: MatterType,
    fromX: number, fromY: number,
    toX: number, toY: number,
    radius: number,
    innerRadius: number,
    ownerId: MatterTankId,
    budget: number,
    playerBounds: PlayerBounds,
    activeSet: TileSet,
    dirtyChunks: Set<number>,
  ): EffectResult {
    const dx = toX - fromX
    const dy = toY - fromY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const spacing = Math.max(1, radius)
    const steps = Math.max(1, Math.ceil(dist / spacing))

    let merged: EffectResult = EMPTY_EFFECT_RESULT
    let remainingBudget = budget

    for (let step = 1; step <= steps; step++) {
      if (remainingBudget <= 0) break
      const t = step / steps
      const px = Math.round(fromX + dx * t)
      const py = Math.round(fromY + dy * t)
      const result = projectile.apply(createType, px, py, radius, innerRadius, ownerId, remainingBudget, playerBounds, activeSet, dirtyChunks)
      remainingBudget -= result.tiles.length
      merged = merged === EMPTY_EFFECT_RESULT ? result : mergeEffectResults(merged, result)
    }

    return merged
  }

  processProjectileSlot(
    slotIdx: number,
    data: ProjectileManagerData,
    fromX: number,
    fromY: number,
    activeSet: TileSet,
    dirtyChunks: Set<number>,
  ): EffectResult {
    const budget = data.tilesToModify[slotIdx] - data.tilesModified[slotIdx]
    if (budget <= 0) return EMPTY_EFFECT_RESULT

    const mode = data.mode[slotIdx] as FireMode
    const tileX = data.tileX[slotIdx]
    const tileY = data.tileY[slotIdx]
    const ownerId = data.ownerId[slotIdx] as MatterTankId

    if (data.shape[slotIdx] === ProjectileShape.FLOOD_FILL) {
      let result: EffectResult
      switch (mode) {
        case FireMode.CREATE: {
          const createType = data.createType[slotIdx] as MatterType
          result = this.floodFillCreate.applyFloodFill(tileX, tileY, createType, ownerId, budget, slotIdx, this.playerBoundsData, activeSet, dirtyChunks)
          break
        }
        case FireMode.DESTROY:
          result = this.floodFillDestroy.applyFloodFill(tileX, tileY, ownerId, budget, slotIdx, activeSet, dirtyChunks)
          break
        default:
          return EMPTY_EFFECT_RESULT
      }
      data.tilesModified[slotIdx] += result.tiles.length
      return result
    }

    const radius = data.radius[slotIdx]
    let result: EffectResult
    switch (mode) {
      case FireMode.CREATE: {
        const createType = data.createType[slotIdx] as MatterType
        const innerRadius = data.innerRadius[slotIdx]
        result = this._sweepApply(
          this.createProjectile, createType, fromX, fromY, tileX, tileY, radius, innerRadius, ownerId, budget, this.playerBoundsData, activeSet, dirtyChunks,
        )
        data.tilesModified[slotIdx] += result.tiles.length
        break
      }
      case FireMode.DESTROY:
        result = this._sweepApply(
          this.destroyProjectile, EMPTY, fromX, fromY, tileX, tileY, radius, 0, ownerId, budget, EMPTY_PLAYER_BOUNDS, activeSet, dirtyChunks,
        )
        data.tilesModified[slotIdx] += result.tiles.length
        break
      case FireMode.MELT:
        result = this._sweepApply(
          this.meltProjectile, EMPTY, fromX, fromY, tileX, tileY, radius, 0, ownerId, Number.MAX_SAFE_INTEGER, EMPTY_PLAYER_BOUNDS, activeSet, dirtyChunks,
        )
        break
      case FireMode.SOLIDIFY:
        result = this._sweepApply(
          this.solidifyProjectile, EMPTY, fromX, fromY, tileX, tileY, radius, 0, ownerId, Number.MAX_SAFE_INTEGER, EMPTY_PLAYER_BOUNDS, activeSet, dirtyChunks,
        )
        break
      default:
        return EMPTY_EFFECT_RESULT
    }

    return result
  }

  processTunnelDestroy(
    fromX: number,
    fromY: number,
    tileX: number,
    tileY: number,
    radius: number,
    tilesToModify: number,
    activeSet: TileSet,
    dirtyChunks: Set<number>,
  ): EffectResult {
    return this._sweepApply(
      this.destroyProjectile, EMPTY, fromX, fromY, tileX, tileY, radius, 0, NO_MATTER_TANK_ID, tilesToModify, EMPTY_PLAYER_BOUNDS, activeSet, dirtyChunks,
    )
  }
}
