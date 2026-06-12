import { MatterType, MatterTypeSet, SAND, SOLID, WATER } from '../../../Matter/_Matter.types.ts'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import type { Tilemap } from '../../../Tilemap/Tilemap.ts'
import { addTileHighlights, noVFX } from '../_ProjectileEffect-helpers.ts'
import type { ProjectileEffect, ProjectileEffectResult } from '../_ProjectileEffect.types.ts'

export const MELT_EFFECT: ProjectileEffect = {
  mode: FireMode.MELT,
  reactsWithMatterTypes: new MatterTypeSet(SOLID, SAND),
  convertMatterType(t: MatterType): MatterType | null {
    if (t === SOLID) return SAND
    if (t === SAND) return WATER
    return null
  },
  onTilesCommitted(tm: Tilemap, out: ProjectileEffectResult[]): void {
    addTileHighlights(tm, out, FireMode.MELT)
    tm.onActivateTiles?.(out)
    const islands = tm.findNewlyDisconnectedByDestruction(out)
    if (islands.length) tm.onIslandDetected?.(islands)
  },
  onApplied: noVFX,
}