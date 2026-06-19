import { MatterType, SAND, SOLID } from '../../../Matter/_Matter.types.ts'
import { MatterTypeSet } from '../../../Matter/data/MatterTypeSet'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import { noVFX } from '../_ProjectileEffect-helpers.ts'
import type { ProjectileEffect } from '../_ProjectileEffect.types.ts'
import { convertMatterTile } from '../convertMatterTile.ts'

export const MELT_EFFECT: ProjectileEffect = {
  mode: FireMode.MELT,
  reactsWithMatterTypes: new MatterTypeSet(SOLID, SAND),
  convertMatterType: (t, ownerId) => convertMatterTile(FireMode.MELT, MatterType.SOLID, t, ownerId),
  onApplied: noVFX,
}