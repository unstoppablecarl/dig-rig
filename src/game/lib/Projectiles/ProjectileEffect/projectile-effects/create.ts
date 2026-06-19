import type { Position } from '../../../../types.ts'
import { MatterType } from '../../../Matter/_Matter.types.ts'
import { MatterTypeSet } from '../../../Matter/data/MatterTypeSet'
import { SETTLING_TYPES } from '../../../Matter/matter.ts'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import type { Tilemap } from '../../../Tilemap/Tilemap.ts'
import { noVFX } from '../_ProjectileEffect-helpers.ts'
import type { ProjectileEffect, ProjectileEffectResult } from '../_ProjectileEffect.types.ts'
import { convertMatterTile } from '../convertMatterTile.ts'

function createApplied(
  tilemap: Tilemap,
  emitPos: Position,
  _collectPos: Position,
  tiles: ProjectileEffectResult[],
): void {
  tilemap.scene.vfxParticleManager.spawnMatterToTiles(emitPos, tiles)
}

export function makeCreateEffect(type: MatterType): ProjectileEffect {
  const passive = !SETTLING_TYPES.has(type)

  return {
    mode: FireMode.CREATE,
    createType: type,
    reactsWithMatterTypes: new MatterTypeSet(type),
    convertMatterType: (t, ownerId) => convertMatterTile(FireMode.CREATE, type, t, ownerId),
    onApplied: passive ? createApplied : noVFX,
  }
}
