/// <reference lib="webworker" />
import { FireMode } from '../../../Player/_FireMode-types.ts'
import { EMPTY_PLAYER_BOUNDS, type PlayerBoundsDataType } from '../../data/PlayerBoundsData.ts'
import type { ProjectileManagerData } from '../../data/ProjectileManagerData.ts'
import { EMPTY, matterType, MatterType, SOLID, SupportType } from '../../../Matter/_Matter.types.ts'
import { getSupportType, SETTLING_TYPES } from '../../../Matter/matter.ts'
import type { MatterTankId } from '../../../Matter/Tank/_MatterTank.types.ts'
import type { CoordinatorInMsgBrushEraseMatter } from '../Coordinator.types.ts'
import type { MatterSim } from '../MatterSim/MatterSim.ts'
import { Physics } from './Physics.ts'
import type { EffectResult } from './Projectile.ts'
import { ProjectileCreate } from './ProjectileCreate.ts'
import { ProjectileDestroy } from './ProjectileDestroy.ts'
import { ProjectileMelt } from './ProjectileMelt.ts'
import { ProjectileSolidify } from './ProjectileSolidify.ts'

export type WriteEntry = {
  indices: number[]
  tile: number
  reactivateAround: boolean
}

export class Effects {
  private readonly createProjectile: ProjectileCreate
  private readonly destroyProjectile: ProjectileDestroy
  private readonly meltProjectile: ProjectileMelt
  private readonly solidifyProjectile: ProjectileSolidify

  constructor(
    private readonly sim: MatterSim,
    private readonly physics: Physics,
    private readonly playerBoundsData: PlayerBoundsDataType,
    private readonly width: number,
    height: number,
  ) {
    this.createProjectile = new ProjectileCreate(sim, physics, width, height)
    this.destroyProjectile = new ProjectileDestroy(sim, physics, width, height)
    this.meltProjectile = new ProjectileMelt(sim, physics, width, height)
    this.solidifyProjectile = new ProjectileSolidify(sim, physics, width, height)
  }

  applyTileWrites(
    writes: WriteEntry[],
    activeSet: Set<number>,
    dirtyChunks: Set<number>,
  ): boolean {
    const tiles = this.sim.tiles
    const w = this.width
    let structuralDirty = false

    for (const { indices, tile, reactivateAround } of writes) {
      for (const idx of indices) {
        const x = idx % w
        const y = idx / w | 0
        if (!structuralDirty && (getSupportType(tiles[idx]) >= SupportType.STRUCTURAL || getSupportType(tile) >= SupportType.STRUCTURAL)) {
          structuralDirty = true
        }
        tiles[idx] = tile
        this.sim.markDirty(x, y)
        dirtyChunks.add(this.physics.chunkIdxForTile(idx))
        if (reactivateAround) this.sim.reactivateAround(x, y, activeSet)
      }

      const t = matterType(tile)
      if (t !== EMPTY && SETTLING_TYPES.has(t)) this.sim.activate(indices, activeSet)

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
    activeSet: Set<number>,
    dirtyChunks: Set<number>,
  ): EffectResult {
    return this.destroyProjectile.apply(
      SOLID, req.tileX, req.tileY, req.tileRadius, 0,
      req.ownerId, Number.MAX_SAFE_INTEGER,
      EMPTY_PLAYER_BOUNDS,
      activeSet, dirtyChunks,
    )
  }

  processProjectileSlot(
    slotIdx: number,
    data: ProjectileManagerData,
    activeSet: Set<number>,
    dirtyChunks: Set<number>,
  ): EffectResult {
    const budget = data.tilesToModify[slotIdx] - data.tilesModified[slotIdx]
    if (budget <= 0) return { tiles: [], structuralDirty: false }

    const pb = this.playerBoundsData
    const mode = data.mode[slotIdx] as FireMode
    const createType = data.createType[slotIdx] as MatterType
    const tileX = data.tileX[slotIdx]
    const tileY = data.tileY[slotIdx]
    const radius = data.radius[slotIdx]
    const innerRadius = data.innerRadius[slotIdx]
    const ownerId = data.ownerId[slotIdx] as MatterTankId

    let result: EffectResult
    switch (mode) {
      case FireMode.CREATE:
        result = this.createProjectile.apply(
          createType, tileX, tileY, radius, innerRadius, ownerId, budget,
          pb,
          activeSet, dirtyChunks,
        )
        break
      case FireMode.DESTROY:
        result = this.destroyProjectile.apply(
          SOLID, tileX, tileY, radius, innerRadius, ownerId, budget,
          EMPTY_PLAYER_BOUNDS,
          activeSet, dirtyChunks,
        )
        break
      case FireMode.MELT:
        result = this.meltProjectile.apply(SOLID, tileX, tileY, radius, 0, ownerId, Number.MAX_SAFE_INTEGER, EMPTY_PLAYER_BOUNDS, activeSet, dirtyChunks)
        break
      case FireMode.SOLIDIFY:
        result = this.solidifyProjectile.apply(
          SOLID, tileX, tileY, radius, innerRadius, ownerId, budget,
          EMPTY_PLAYER_BOUNDS,
          activeSet, dirtyChunks,
        )
        break
    }

    data.tilesModified[slotIdx] += result!.tiles.length
    return result!
  }

  // DESTROY-only fast path for the SAB-driven destroy zone; no playerBounds.
  processTunnelDestroy(
    tileX: number, tileY: number, radius: number, tilesToModify: number, ownerId: MatterTankId,
    activeSet: Set<number>, dirtyChunks: Set<number>,
  ): EffectResult {
    return this.destroyProjectile.apply(
      SOLID, tileX, tileY, radius, 0, ownerId, tilesToModify,
      EMPTY_PLAYER_BOUNDS,
      activeSet, dirtyChunks,
    )
  }
}
