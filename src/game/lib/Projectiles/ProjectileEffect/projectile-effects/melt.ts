import { MatterType, SAND, SOLID } from '../../../Matter/_Matter.types.ts'
import { MatterTypeSet } from '../../../Matter/data/MatterTypeSet'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import type { Tilemap } from '../../../Tilemap/Tilemap.ts'
import { addTileFireModeEffect, noVFX } from '../_ProjectileEffect-helpers.ts'
import { convertMatterTile } from '../convertMatterTile.ts'
import type { ProjectileEffect, ProjectileEffectResult } from '../_ProjectileEffect.types.ts'

export const MELT_EFFECT: ProjectileEffect = {
  mode: FireMode.MELT,
  reactsWithMatterTypes: new MatterTypeSet(SOLID, SAND),
  convertMatterType: (t, ownerId) => convertMatterTile(FireMode.MELT, MatterType.SOLID, t, ownerId),
  onTilesCommitted(tm: Tilemap, out: ProjectileEffectResult[]): void {
    addTileFireModeEffect(tm, out, FireMode.MELT)
    tm.onActivateTiles?.(out)
    const islands = tm.findNewlyDisconnectedByDestruction(out)
    if (islands.length) tm.onIslandDetected?.(islands)
  },
  onApplied: noVFX,
}