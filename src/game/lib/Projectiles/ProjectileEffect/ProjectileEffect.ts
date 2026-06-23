import { EMPTY, FIRE, MatterType, PERMANENT, SAND, SOLID, WATER } from '../../Matter/_Matter.types.ts'
import { MatterTypeSet, matterTypeSetExcluding } from '../../Matter/data/MatterTypeSet.ts'
import { FireMode } from '../../Player/_FireMode-types.ts'
import type { ProjectileEffect } from './_ProjectileEffect.types.ts'

export function makeCreateEffect(type: MatterType): ProjectileEffect {
  return {
    mode: FireMode.CREATE,
    createType: type,
    instantProjectileCollidesWith: matterTypeSetExcluding([EMPTY]),
  }
}

export const PROJECTILE_EFFECT = {
  CREATE_SOLID: makeCreateEffect(MatterType.SOLID),
  CREATE_SAND: makeCreateEffect(MatterType.SAND),
  CREATE_WATER: makeCreateEffect(MatterType.WATER),
  CREATE_ACID: makeCreateEffect(MatterType.ACID),
  CREATE_LAVA: makeCreateEffect(MatterType.LAVA),
  DESTROY: {
    mode: FireMode.DESTROY,
    instantProjectileCollidesWith: matterTypeSetExcluding([PERMANENT, EMPTY, WATER, FIRE]),
  },
  MELT: {
    mode: FireMode.MELT,
    instantProjectileCollidesWith: new MatterTypeSet(SOLID, SAND),
  },
  SOLIDIFY: {
    mode: FireMode.SOLIDIFY,
    instantProjectileCollidesWith: new MatterTypeSet(WATER, SAND),
  },
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
