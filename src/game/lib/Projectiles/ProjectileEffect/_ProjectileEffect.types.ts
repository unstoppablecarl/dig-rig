import { MatterType } from '../../Matter/_Matter.types.ts'
import { MatterTypeSet } from '../../Matter/data/MatterTypeSet.ts'
import { FireMode } from '../../Player/_FireMode-types.ts'
import type { Tile } from '../../Tilemap/TileGrid.ts'

export type ProjectileEffectResult = Tile & {
  newValue: MatterType,
}

export type ProjectileEffect = {
  readonly mode: FireMode,
  readonly createType?: MatterType,
  readonly collidesWithMatterTypes: MatterTypeSet,
}
