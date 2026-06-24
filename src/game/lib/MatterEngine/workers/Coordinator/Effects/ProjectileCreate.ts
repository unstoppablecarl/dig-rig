/// <reference lib="webworker" />
import { EMPTY, MatterType, setOwner } from '../../../../Matter/_Matter.types.ts'
import { canHaveOwner, doesSettle } from '../../../../Matter/matter.ts'
import type { MatterTankId } from '../../../../Matter/Tank/_MatterTank.types.ts'
import type { PlayerBounds } from '../../../data/PlayerBoundsData.ts'
import { type ProjectileEffectResult, SimProjectile } from './SimProjectile.ts'

export class ProjectileCreate extends SimProjectile {
  protected convertTile(existing: MatterType, createType: MatterType, ownerId: MatterTankId): MatterType | null {
    if (existing !== EMPTY) return null
    return canHaveOwner(createType) ? setOwner(createType, ownerId) : createType
  }

  protected shouldSkipTile(x: number, y: number, p: PlayerBounds): boolean {
    return x > p.left && x < p.right && y > p.top && y < p.bottom
  }

  protected postApply(candidates: ProjectileEffectResult[], createType: MatterType, activeSet: Set<number>): void {
    if (doesSettle(createType)) {
      this.sim.activateTiles(candidates, activeSet)
    }
  }
}
