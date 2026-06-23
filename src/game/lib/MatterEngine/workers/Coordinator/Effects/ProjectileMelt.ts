/// <reference lib="webworker" />
import { MatterType } from '../../../../Matter/_Matter.types.ts'
import type { MatterTankId } from '../../../../Matter/Tank/_MatterTank.types.ts'
import { type ProjectileEffectResult, SimProjectile } from './SimProjectile.ts'

export class ProjectileMelt extends SimProjectile {
  protected convertTile(existing: MatterType, _createType: MatterType, _ownerId: MatterTankId): MatterType | null {
    if (existing === MatterType.SOLID) return MatterType.SAND
    if (existing === MatterType.SAND) return MatterType.WATER
    return null
  }

  protected postApply(candidates: ProjectileEffectResult[], _createType: MatterType, activeSet: Set<number>, dirtyChunks: Set<number>): void {
    this.sim.activateTiles(candidates, activeSet)
    const islands = this.physics.findNewlyDisconnected(candidates, dirtyChunks)
    if (islands.length > 0) this.physics.collapseIslands(islands, activeSet, dirtyChunks)
  }
}
