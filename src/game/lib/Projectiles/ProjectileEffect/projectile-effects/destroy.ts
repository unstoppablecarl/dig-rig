import { MatterType } from '../../../Matter/_Matter-types.ts'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import type { Tilemap } from '../../../Tilemap/Tilemap.ts'
import { addTileHighlights, destroyApplied } from '../_ProjectileEffect-helpers.ts'
import type { ProjectileEffectDef, ProjectileEffectResult } from '../_ProjectileEffect.types.ts'

const DESTROY_SKIP = new Set([MatterType.PERMANENT, MatterType.EMPTY, MatterType.SAND, MatterType.WATER])

export const DESTROY_EFFECT: ProjectileEffectDef = {
  chargeMode: FireMode.DESTROY,
  convertMatterType: (t: MatterType) => DESTROY_SKIP.has(t) ? null : MatterType.EMPTY,
  onTilesCommitted(tm: Tilemap, out: ProjectileEffectResult[]): void {
    addTileHighlights(tm, out, FireMode.DESTROY)
    const islands = tm.findNewlyDisconnectedByDestruction(out)
    if (islands.length) tm.onIslandDetected?.(islands)
  },
  onApplied: destroyApplied,
}