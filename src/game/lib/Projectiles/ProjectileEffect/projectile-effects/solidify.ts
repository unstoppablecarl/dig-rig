import { MatterType, SAND, WATER } from '../../../Matter/_Matter.types'
import { MatterTypeSet } from '../../../Matter/data/MatterTypeSet'
import { FireMode } from '../../../Player/_FireMode-types'
import { noVFX } from '../_ProjectileEffect-helpers.ts'
import type { ProjectileEffect } from '../_ProjectileEffect.types.ts'
import { convertMatterTile } from '../convertMatterTile.ts'

export const SOLIDIFY_EFFECT: ProjectileEffect = {
  mode: FireMode.SOLIDIFY,
  reactsWithMatterTypes: new MatterTypeSet(WATER, SAND),
  convertMatterType: (t, ownerId) => convertMatterTile(FireMode.SOLIDIFY, MatterType.SOLID, t, ownerId),
  onApplied: noVFX,
}