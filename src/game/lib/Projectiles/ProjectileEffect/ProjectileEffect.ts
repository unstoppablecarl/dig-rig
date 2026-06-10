import { shuffleArray } from '../../../helpers/array.ts'
import type { Position } from '../../../types.ts'
import { PASSIVE_MATER_TYPES } from '../../Matter/_Matter-meta'
import { MatterType, MatterTypeSet } from '../../Matter/_Matter-types.ts'
import { FireMode } from '../../Player/_FireMode-types.ts'
import type { Tilemap } from '../../Tilemap/Tilemap.ts'
import { addTileHighlights, chunkAndIslandCheck, filterPlayerAABB, noVFX } from './_ProjectileEffect-helpers.ts'
import type { ProjectileEffect, ProjectileEffectResult } from './_ProjectileEffect.types.ts'
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

export function makeCreateEffect(type: MatterType): ProjectileEffect {
  const passive = PASSIVE_MATER_TYPES.has(type)
  return {
    mode: FireMode.CREATE,
    filterTile: filterPlayerAABB,
    reactsWithMatterTypes: new MatterTypeSet(type),
    convertMatterType: (t: MatterType) => t === MatterType.EMPTY ? type : null,
    onTilesCommitted: passive ? solidCreateTilesCommitted : liquidCreateTilesCommitted,
    onApplied: passive ? solidCreateApplied : noVFX,
  }
}

export const PROJECTILE_EFFECT = {
  CREATE_SOLID: makeCreateEffect(MatterType.SOLID),
  CREATE_SAND: makeCreateEffect(MatterType.SAND),
  CREATE_WATER: makeCreateEffect(MatterType.WATER),
  CREATE_ACID: makeCreateEffect(MatterType.ACID),
  CREATE_LAVA: makeCreateEffect(MatterType.LAVA),
  DESTROY: DESTROY_EFFECT,
  MELT: MELT_EFFECT,
  SOLIDIFY: SOLIDIFY_EFFECT,
} as const satisfies Record<string, ProjectileEffect>

export type ProjectileEffectType = keyof typeof PROJECTILE_EFFECT

export const PROJECTILE_CREATE_EFFECT = {
  [MatterType.SOLID]: PROJECTILE_EFFECT.CREATE_SOLID,
  [MatterType.SAND]: PROJECTILE_EFFECT.CREATE_SAND,
  [MatterType.WATER]: PROJECTILE_EFFECT.CREATE_WATER,
  [MatterType.ACID]: PROJECTILE_EFFECT.CREATE_ACID,
  [MatterType.LAVA]: PROJECTILE_EFFECT.CREATE_LAVA,
} as const satisfies Partial<Record<MatterType, ProjectileEffect>>

export type CreateableMatterType = keyof typeof PROJECTILE_CREATE_EFFECT
export const CreateableMatterTypes = Object.keys(PROJECTILE_CREATE_EFFECT).map(Number) as CreateableMatterType[]

const FIRE_MODE_TO_NON_CREATE_EFFECT: Record<Exclude<FireMode, FireMode.CREATE>, ProjectileEffect> = {
  [FireMode.DESTROY]: PROJECTILE_EFFECT.DESTROY,
  [FireMode.MELT]: PROJECTILE_EFFECT.MELT,
  [FireMode.SOLIDIFY]: PROJECTILE_EFFECT.SOLIDIFY,
}

export function fireModeToEffect(mode: FireMode, createType: CreateableMatterType = MatterType.SOLID) {
  if (mode === FireMode.CREATE) {
    return PROJECTILE_CREATE_EFFECT[createType]
  }
  return FIRE_MODE_TO_NON_CREATE_EFFECT[mode]
}
