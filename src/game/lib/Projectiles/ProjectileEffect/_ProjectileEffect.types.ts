import type { ParticleTarget, Position } from '../../../types.ts'
import { MatterType } from '../../Matter/_Matter.types.ts'
import { MatterTypeSet } from '../../Matter/data/MatterTypeSet'
import type { MatterTankId } from '../../Matter/MatterTank/_MatterTank.types.ts'
import { FireMode } from '../../Player/_FireMode-types.ts'
import type { Tile, Tilemap } from '../../Tilemap/Tilemap.ts'

export type ProjectileEffectResult = Tile & {
  newValue: MatterType,
}

export type ProjectileEffect = {
  readonly mode: FireMode,
  readonly createType?: MatterType,
  reactsWithMatterTypes: MatterTypeSet,
  convertMatterType(existingType: MatterType, ownerId?: MatterTankId): MatterType | null
  onApplied(
    tilemap: Tilemap,
    emitPos: Position,
    collectTarget: ParticleTarget,
    tiles: ProjectileEffectResult[],
  ): void
}
