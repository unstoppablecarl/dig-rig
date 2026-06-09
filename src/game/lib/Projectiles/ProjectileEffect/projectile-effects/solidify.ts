import { MatterType, MatterTypeSet, SAND, SOLID, WATER } from '../../../Matter/_Matter-types'
import { FireMode } from '../../../Player/_FireMode-types'
import type { Tilemap } from '../../../Tilemap/Tilemap'
import { addTileHighlights, chunkAndIslandCheck, noVFX } from '../_ProjectileEffect-helpers.ts'
import type { ProjectileEffectDef, ProjectileEffectResult } from '../_ProjectileEffect.types.ts'

export const SOLIDIFY_EFFECT: ProjectileEffectDef = {
  chargeMode: null,
  reactsWithMatterTypes: new MatterTypeSet(WATER, SAND),
  convertMatterType(t: MatterType): MatterType | null {
    if (t === WATER) return SAND
    if (t === SAND) return SOLID
    return null
  },
  onTilesCommitted(tm: Tilemap, out: ProjectileEffectResult[]): void {
    addTileHighlights(tm, out, FireMode.SOLIDIFY)
    tm.onActivateTiles?.(out)
    if (out.some(t => t.newValue === MatterType.SOLID)) chunkAndIslandCheck(tm, out)
  },
  onApplied: noVFX,
}