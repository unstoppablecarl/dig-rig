import type { Position } from '../../../types.ts'
import { MatterType, MatterTypeSet } from '../../Matter/_Matter-types.ts'
import { FireMode } from '../../Player/_FireMode-types.ts'
import type { Tile, Tilemap } from '../../Tilemap/Tilemap.ts'

export type ProjectileEffectResult = Tile & {
  newValue: MatterType,
}


export type ProjectileEffect = {
  readonly mode: FireMode,
  reactsWithMatterTypes: MatterTypeSet,
  filterTile?(tilemap: Tilemap, x: number, y: number): boolean
  convertMatterType(existingType: MatterType): MatterType | null
  onTilesCommitted(tilemap: Tilemap, out: ProjectileEffectResult[]): void
  onApplied(
    tilemap: Tilemap,
    emitPos: Position,
    collectPos: Position,
    tiles: ProjectileEffectResult[],
  ): void
}
