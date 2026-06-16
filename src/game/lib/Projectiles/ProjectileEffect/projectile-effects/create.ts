import type { Position } from '../../../../types.ts'
import { MatterType, setOwner } from '../../../Matter/_Matter.types.ts'
import { MatterTypeSet } from '../../../Matter/data/MatterTypeSet'

import { OWNED_MATTER_TYPES, SETTLING_TYPES } from '../../../Matter/matter.ts'
import { NO_MATTER_TANK_ID } from '../../../Matter/MatterTank/_MatterTank.types.ts'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import type { Tilemap } from '../../../Tilemap/Tilemap.ts'
import { addTileFireModeEffect, filterPlayerAABB, noVFX } from '../_ProjectileEffect-helpers.ts'
import type { ProjectileEffect, ProjectileEffectResult } from '../_ProjectileEffect.types.ts'

function createApplied(
  tilemap: Tilemap,
  emitPos: Position,
  _collectPos: Position,
  tiles: ProjectileEffectResult[],
): void {
  tilemap.scene.vfxParticleManager.spawnMatterToTiles(emitPos, tiles)
}

const solidCreateTilesCommitted: ProjectileEffect['onTilesCommitted'] = (tm: Tilemap, tiles: ProjectileEffectResult[]): void => {
  addTileFireModeEffect(tm, tiles, FireMode.CREATE)
}

const liquidCreateTilesCommitted: ProjectileEffect['onTilesCommitted'] = (tm: Tilemap, tiles: ProjectileEffectResult[]): void => {
  addTileFireModeEffect(tm, tiles, FireMode.CREATE)
  tm.scene.matterBridge.activateTiles(tiles)
}

export function makeCreateEffect(type: MatterType): ProjectileEffect {
  const passive = !SETTLING_TYPES.has(type)

  const convertWithOwnerId: ProjectileEffect['convertMatterType'] = (t: MatterType, ownerId) => {
    if (t === MatterType.EMPTY) {
      return setOwner(type, ownerId ?? NO_MATTER_TANK_ID)
    }
    return null
  }
  const convert: ProjectileEffect['convertMatterType'] = (t: MatterType) => t === MatterType.EMPTY ? type : null

  return {
    mode: FireMode.CREATE,
    filterTile: filterPlayerAABB,
    reactsWithMatterTypes: new MatterTypeSet(type),
    convertMatterType: OWNED_MATTER_TYPES.has(type) ? convertWithOwnerId : convert,
    onTilesCommitted: passive ? solidCreateTilesCommitted : liquidCreateTilesCommitted,
    onApplied: passive ? createApplied : noVFX,
  }
}
