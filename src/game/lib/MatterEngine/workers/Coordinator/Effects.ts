/// <reference lib="webworker" />
import { EMPTY, MatterType, matterType, SOLID, SupportType } from '../../../Matter/_Matter.types.ts'
import { doesSettle, getSupportType } from '../../../Matter/matter.ts'
import { type MatterTankId, NO_MATTER_TANK_ID } from '../../../Matter/Tank/_MatterTank.types.ts'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import { EMPTY_PLAYER_BOUNDS, type PlayerBoundsDataType } from '../../data/PlayerBoundsData.ts'
import { type ProjectileManagerData, ProjectileShape } from '../../data/ProjectileManagerData.ts'
import type { CoordinatorInMsgBrushEraseMatter } from '../Coordinator.types.ts'
import type { MatterSim } from '../MatterSim/MatterSim.ts'
import { FloodFillCreate } from './Effects/FloodFillCreate.ts'
import { FloodFillDestroy } from './Effects/FloodFillDestroy.ts'
import { ProjectileCreate } from './Effects/ProjectileCreate.ts'
import { ProjectileDestroy } from './Effects/ProjectileDestroy.ts'
import { ProjectileMelt } from './Effects/ProjectileMelt.ts'
import { ProjectileSolidify } from './Effects/ProjectileSolidify.ts'
import type { EffectResult } from './Effects/SimProjectile.ts'
import { Physics } from './Physics.ts'
import type { SimMatterTanks } from './SimMatterTanks.ts'

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
  private readonly floodFillCreate: FloodFillCreate
  private readonly floodFillDestroy: FloodFillDestroy
  readonly width: number
  readonly height: number

  constructor(
    private readonly sim: MatterSim,
    private readonly physics: Physics,
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
    activeSet: Set<number>,
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
        tiles[idx] = tile
        this.sim.markDirty(x, y)
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
    activeSet: Set<number>,
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

  processProjectileSlot(
    slotIdx: number,
    data: ProjectileManagerData,
    activeSet: Set<number>,
    dirtyChunks: Set<number>,
  ): EffectResult {
    const budget = data.tilesToModify[slotIdx] - data.tilesModified[slotIdx]
    if (budget <= 0) return { tiles: [], structuralDirty: false }

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
          return { tiles: [], structuralDirty: false }
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
        result = this.createProjectile.apply(createType, tileX, tileY, radius, innerRadius, ownerId, budget, this.playerBoundsData, activeSet, dirtyChunks)
        data.tilesModified[slotIdx] += result.tiles.length
        break
      }
      case FireMode.DESTROY:
        result = this.destroyProjectile.apply(EMPTY, tileX, tileY, radius, 0, ownerId, budget, EMPTY_PLAYER_BOUNDS, activeSet, dirtyChunks)
        data.tilesModified[slotIdx] += result.tiles.length
        break
      case FireMode.MELT:
        result = this.meltProjectile.apply(EMPTY, tileX, tileY, radius, 0, ownerId, Number.MAX_SAFE_INTEGER, EMPTY_PLAYER_BOUNDS, activeSet, dirtyChunks)
        break
      case FireMode.SOLIDIFY:
        result = this.solidifyProjectile.apply(EMPTY, tileX, tileY, radius, 0, ownerId, Number.MAX_SAFE_INTEGER, EMPTY_PLAYER_BOUNDS, activeSet, dirtyChunks)
        break
      default:
        return { tiles: [], structuralDirty: false }
    }

    return result
  }

  processTunnelDestroy(
    tileX: number,
    tileY: number,
    radius: number,
    tilesToModify: number,
    activeSet: Set<number>,
    dirtyChunks: Set<number>,
  ): EffectResult {
    return this.destroyProjectile.apply(EMPTY, tileX, tileY, radius, 0, NO_MATTER_TANK_ID, tilesToModify, EMPTY_PLAYER_BOUNDS, activeSet, dirtyChunks)
  }
}
