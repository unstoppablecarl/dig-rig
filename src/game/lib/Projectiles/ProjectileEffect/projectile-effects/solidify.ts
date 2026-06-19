import { MatterType, SAND, WATER } from '../../../Matter/_Matter.types'
import { MatterTypeSet } from '../../../Matter/data/MatterTypeSet'
import { FireMode } from '../../../Player/_FireMode-types'
import type { Tilemap } from '../../../Tilemap/Tilemap'
import { addTileFireModeEffect, chunkAndIslandCheck, noVFX } from '../_ProjectileEffect-helpers.ts'
import { convertMatterTile } from '../convertMatterTile.ts'
import type { ProjectileEffect, ProjectileEffectResult } from '../_ProjectileEffect.types.ts'

export const SOLIDIFY_EFFECT: ProjectileEffect = {
  mode: FireMode.SOLIDIFY,
  reactsWithMatterTypes: new MatterTypeSet(WATER, SAND),
  convertMatterType: (t, ownerId) => convertMatterTile(FireMode.SOLIDIFY, MatterType.SOLID, t, ownerId),
  onTilesCommitted(tm: Tilemap, out: ProjectileEffectResult[]): void {
    addTileFireModeEffect(tm, out, FireMode.SOLIDIFY)
    tm.onActivateTiles?.(out)
    if (out.some(t => t.newValue === MatterType.SOLID)) chunkAndIslandCheck(tm, out)
  },
  onApplied: noVFX,
}