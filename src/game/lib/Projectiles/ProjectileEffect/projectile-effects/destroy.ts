import type { ParticleTarget } from '../../../../types.ts'
import { EMPTY, FIRE, PERMANENT, SOLID, WATER } from '../../../Matter/_Matter.types.ts'
import { matterTypeSetExcluding } from '../../../Matter/data/MatterTypeSet'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import type { Tilemap } from '../../../Tilemap/Tilemap.ts'
import type { ProjectileEffect, ProjectileEffectResult } from '../_ProjectileEffect.types.ts'
import { convertMatterTile } from '../convertMatterTile.ts'

const reactsWithMatterTypes = matterTypeSetExcluding([PERMANENT, EMPTY, WATER, FIRE])
export const DESTROY_EFFECT: ProjectileEffect = {
  mode: FireMode.DESTROY,
  reactsWithMatterTypes,
  convertMatterType: (t, ownerId) => convertMatterTile(FireMode.DESTROY, SOLID, t, ownerId),
  onApplied(
    tilemap: Tilemap,
    _emitPos,
    collectTarget: ParticleTarget,
    tiles: ProjectileEffectResult[],
  ): void {
    tilemap.scene.vfxParticleManager.spawnMatterFromTiles(tiles, collectTarget)
  },
}