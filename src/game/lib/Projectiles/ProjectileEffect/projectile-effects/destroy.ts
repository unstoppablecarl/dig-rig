import type { Position } from '../../../../types.ts'
import { EMPTY, MatterType, matterTypeSetExcluding, PERMANENT, SAND, WATER } from '../../../Matter/_Matter.types.ts'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import type { Tilemap } from '../../../Tilemap/Tilemap.ts'
import { addTileHighlights } from '../_ProjectileEffect-helpers.ts'
import type { ProjectileEffect, ProjectileEffectResult } from '../_ProjectileEffect.types.ts'

const reactsWithMatterTypes = matterTypeSetExcluding([PERMANENT, EMPTY, SAND, WATER])
export const DESTROY_EFFECT: ProjectileEffect = {
  mode: FireMode.DESTROY,
  reactsWithMatterTypes,
  convertMatterType: (t: MatterType) => reactsWithMatterTypes.has(t) ? MatterType.EMPTY : null,
  onTilesCommitted(tm: Tilemap, out: ProjectileEffectResult[]): void {
    addTileHighlights(tm, out, FireMode.DESTROY)
    const islands = tm.findNewlyDisconnectedByDestruction(out)
    if (islands.length) tm.onIslandDetected?.(islands)
  },
  onApplied(
    tilemap: Tilemap,
    _emitPos: Position,
    collectPos: Position,
    tiles: ProjectileEffectResult[],
  ): void {
    tilemap.scene.vfxParticleManager.spawnMatterFromTiles(tiles, collectPos)
  },
}