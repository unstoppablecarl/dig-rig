import { MatterType } from '../../Matter/_Matter.types.ts'
import { MatterTypeSet } from '../../Matter/data/MatterTypeSet.ts'
import { FireMode } from '../../Player/_FireMode-types.ts'

export type ProjectileEffect = {
  readonly mode: FireMode,
  readonly createType?: MatterType,
  readonly instantProjectileCollidesWith: MatterTypeSet,
}
