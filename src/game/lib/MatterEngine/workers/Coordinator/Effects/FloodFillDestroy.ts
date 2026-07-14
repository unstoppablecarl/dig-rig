/// <reference lib="webworker" />
import { EMPTY, FIRE, MatterType, matterType } from '../../../../Matter/_Matter.types.ts'
import { MatterTypeSet } from '../../../../Matter/data/MatterTypeSet.ts'
import { INDESTRUCTIBLE_TYPES } from '../../../../Matter/matter.ts'
import type { MatterTankId } from '../../../../Matter/Tank/_MatterTank.types.ts'
import { FloodFillFrontier } from './FloodFillFrontier.ts'
import { ProjectileDestroy } from './ProjectileDestroy.ts'
import type { EffectResult, ProjectileEffectResult } from './SimProjectile.ts'

import type { TileSet } from '../../../data/SparseTileSet.ts'
// Flood fill destroy treats water as destroyable (same as solids), unlike the radius-based
// destroy which passes through water. WATER is intentionally absent from this set.
const FLOOD_IGNORE = new MatterTypeSet(INDESTRUCTIBLE_TYPES, EMPTY, FIRE)

export class FloodFillDestroy extends ProjectileDestroy {
  protected override convertTile(existing: MatterType, _createType: MatterType, _ownerId: MatterTankId): MatterType | null {
    return FLOOD_IGNORE.has(existing) ? null : EMPTY
  }

  private readonly frontier = new FloodFillFrontier()

  applyFloodFill(
    tileX: number,
    tileY: number,
    ownerId: MatterTankId,
    budget: number,
    slotIdx: number,
    activeSet: TileSet,
    dirtyChunks: Set<number>,
  ): EffectResult {
    const tiles = this.sim.tiles
    const { width, height } = this
    const seedIdx = tileY * width + tileX
    const neighbors8 = [
      tileX > 0 && tileY > 0 ? seedIdx - width - 1 : -1,
      tileY > 0 ? seedIdx - width : -1,
      tileX < width - 1 && tileY > 0 ? seedIdx - width + 1 : -1,
      tileX > 0 ? seedIdx - 1 : -1,
      tileX < width - 1 ? seedIdx + 1 : -1,
      tileX > 0 && tileY < height - 1 ? seedIdx + width - 1 : -1,
      tileY < height - 1 ? seedIdx + width : -1,
      tileX < width - 1 && tileY < height - 1 ? seedIdx + width + 1 : -1,
    ]

    const indices = this.frontier.collect(slotIdx, seedIdx, budget, width, height, (idx) =>
        this.convertTile(matterType(tiles[idx]), EMPTY, ownerId) !== null,
      neighbors8,
    )

    const candidates: ProjectileEffectResult[] = []
    for (const idx of indices) {
      const x = idx % width
      const y = (idx / width) | 0
      const newValue = this.convertTile(matterType(tiles[idx]), EMPTY, ownerId)
      if (newValue !== null) candidates.push({ x, y, newValue })
    }

    return this._writeCandidates(candidates, EMPTY, activeSet, dirtyChunks)
  }
}
