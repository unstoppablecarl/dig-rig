import { shuffleArray } from '../../../../helpers/array.ts'
import type { Position } from '../../../../types.ts'
import { PASSIVE_MATER_TYPES } from '../../../Matter/_Matter-meta.ts'
import { MatterType, MatterTypeSet } from '../../../Matter/_Matter-types.ts'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import type { Tilemap } from '../../../Tilemap/Tilemap.ts'
import { addTileHighlights, chunkAndIslandCheck, filterPlayerAABB, noVFX } from '../_ProjectileEffect-helpers.ts'
import type { ProjectileEffect, ProjectileEffectResult } from '../_ProjectileEffect.types.ts'

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

function solidCreateTilesCommitted(tm: Tilemap, tiles: ProjectileEffectResult[]): void {
  addTileHighlights(tm, tiles, FireMode.CREATE)
  chunkAndIslandCheck(tm, tiles)
}

function liquidCreateTilesCommitted(tm: Tilemap, tiles: ProjectileEffectResult[]): void {
  solidCreateTilesCommitted(tm, tiles)
  tm.scene.matterBridge.activateTiles(tiles)
}