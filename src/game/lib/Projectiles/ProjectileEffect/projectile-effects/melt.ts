import { MatterType } from '../../../Matter/_Matter-types.ts'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import type { Tilemap } from '../../../Tilemap/Tilemap.ts'
import { addTileHighlights, noVFX } from '../_ProjectileEffect-helpers.ts'
import type { ProjectileEffectDef, ProjectileEffectResult } from '../_ProjectileEffect.types.ts'

export const MELT_EFFECT: ProjectileEffectDef = {
  chargeMode: null,
  convertMatterType(t: MatterType): MatterType | null {
    if (t === MatterType.SOLID) return MatterType.SAND
    if (t === MatterType.SAND) return MatterType.WATER
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