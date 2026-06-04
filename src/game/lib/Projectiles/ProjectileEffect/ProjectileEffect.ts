import { shuffleArray } from '../../../helpers/array.ts'
import type { Position } from '../../../types.ts'
import { MatterType } from '../../Matter/_Matter-types.ts'
import { PASSIVE_ELEMENTS } from '../../Matter/elements.ts'
import { FireMode } from '../../Player/_FireMode-types.ts'
import type { Tilemap } from '../../Tilemap/Tilemap.ts'
import { addTileHighlights, chunkAndIslandCheck, filterPlayerAABB, noVFX } from './_ProjectileEffect-helpers.ts'
import type { ProjectileEffectDef, ProjectileEffectResult } from './_ProjectileEffect.types.ts'
import { DESTROY_EFFECT } from './projectile-effects/destroy.ts'
import { MELT_EFFECT } from './projectile-effects/melt.ts'
import { SOLIDIFY_EFFECT } from './projectile-effects/solidify'

function solidCreateTilesCommitted(tm: Tilemap, tiles: ProjectileEffectResult[]): void {
  addTileHighlights(tm, tiles, FireMode.CREATE)
  chunkAndIslandCheck(tm, tiles)
}

function liquidCreateTilesCommitted(tm: Tilemap, tiles: ProjectileEffectResult[]): void {
  solidCreateTilesCommitted(tm, tiles)
  tm.scene.matterBridge.activateTiles(tiles)
}

function solidCreateApplied(
  tilemap: Tilemap,
  emitPos: Position,
  _collectPos: Position,
  tiles: ProjectileEffectResult[],
): void {
  const shuffled = shuffleArray(tiles)
  for (const tile of shuffled) {
    tilemap.scene.vfxParticleManager.spawnMatter(emitPos, tile, true)
  }
}

export function makeCreateEffect(type: MatterType): ProjectileEffectDef {
  const passive = PASSIVE_ELEMENTS.has(type)
  return {
    chargeMode: FireMode.CREATE,
    filterTile: filterPlayerAABB,
    convertMatterType: (t) => t === MatterType.EMPTY ? type : null,
    onTilesCommitted: passive ? solidCreateTilesCommitted : liquidCreateTilesCommitted,
    onApplied: passive ? solidCreateApplied : noVFX,
  }
}

export const ProjectileEffect = {
  CREATE_SOLID: makeCreateEffect(MatterType.SOLID),
  CREATE_SAND: makeCreateEffect(MatterType.SAND),
  CREATE_WATER: makeCreateEffect(MatterType.WATER),
  CREATE_ACID: makeCreateEffect(MatterType.ACID),
  CREATE_LAVA: makeCreateEffect(MatterType.LAVA),
  DESTROY: DESTROY_EFFECT,
  MELT: MELT_EFFECT,
  SOLIDIFY: SOLIDIFY_EFFECT,
} satisfies Record<string, ProjectileEffectDef>

export const EFFECT_BY_FIRE_MODE: Record<FireMode, ProjectileEffectDef> = {
  [FireMode.CREATE]: ProjectileEffect.CREATE_SOLID,
  [FireMode.DESTROY]: ProjectileEffect.DESTROY,
  [FireMode.MELT]: ProjectileEffect.MELT,
  [FireMode.SOLIDIFY]: ProjectileEffect.SOLIDIFY,
}
