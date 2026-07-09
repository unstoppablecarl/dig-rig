/// <reference lib="webworker" />
import { EMPTY, FIRE, MatterType } from '../../../../Matter/_Matter.types.ts'
import { MatterTypeSet } from '../../../../Matter/data/MatterTypeSet.ts'
import { INDESTRUCTIBLE_TYPES } from '../../../../Matter/matter.ts'
import type { MatterTankId } from '../../../../Matter/Tank/_MatterTank.types.ts'
import { type ProjectileEffectResult, SimProjectile } from './SimProjectile.ts'

const IGNORE = new MatterTypeSet(INDESTRUCTIBLE_TYPES, EMPTY, FIRE)

export class ProjectileDestroy extends SimProjectile {
  protected convertTile(existing: MatterType, _createType: MatterType, _ownerId: MatterTankId): MatterType | null {
    return IGNORE.has(existing) ? null : EMPTY
  }

  protected postApply(candidates: ProjectileEffectResult[], _createType: MatterType, activeSet: Set<number>, dirtyChunks: Set<number>): void {
    if (import.meta.env.DEV) {
      console.log(`[collapse] ProjectileDestroy.postApply candidates=${candidates.length}`)
    }
    const islands = this.physics.findNewlyDisconnected(candidates, dirtyChunks)
    if (import.meta.env.DEV) {
      console.log(`[collapse] ProjectileDestroy islands found=${islands.length}`)
    }
    if (islands.length > 0) this.physics.collapseIslands(islands, activeSet, dirtyChunks)
  }
}
