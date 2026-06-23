/// <reference lib="webworker" />
import { MatterType } from '../../../../Matter/_Matter.types.ts'
import type { MatterTankId } from '../../../../Matter/Tank/_MatterTank.types.ts'
import { SimProjectile, type ProjectileEffectResult } from './SimProjectile.ts'

export class ProjectileSolidify extends SimProjectile {
  protected convertTile(existing: MatterType, _createType: MatterType, _ownerId: MatterTankId): MatterType | null {
    if (existing === MatterType.WATER) return MatterType.SAND
    if (existing === MatterType.SAND) return MatterType.SOLID
    return null
  }

  protected postApply(candidates: ProjectileEffectResult[], _createType: MatterType, activeSet: Set<number>, dirtyChunks: Set<number>): void {
    this.sim.activateTiles(candidates, activeSet)
    const solidTiles = candidates.filter(t => t.newValue === MatterType.SOLID)
    if (solidTiles.length > 0) {
      const islands = this.physics.findIslandTiles(solidTiles)
      if (islands.length > 0) this.physics.collapseIslands(islands, activeSet, dirtyChunks)
    }
  }
}
