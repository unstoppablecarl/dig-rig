import {
  ACID,
  EMPTY,
  FIRE,
  GUNPOWDER,
  LAVA,
  MatterType,
  MatterTypeValues,
  SAND,
  SOLID,
  WATER,
} from '../../Matter/_Matter.types.ts'
import { MatterTypeSet } from '../../Matter/data/MatterTypeSet.ts'
import { collidesWithCreateProjectiles, INDESTRUCTIBLE_TYPES } from '../../Matter/matter.ts'
import { FireMode } from '../../Player/_FireMode-types.ts'
import type { ProjectileEffect } from './_ProjectileEffect.types.ts'

const CREATE_PROJECTILE_PASSTHROUGH = MatterTypeValues.filter(t => !collidesWithCreateProjectiles(t))

export function makeCreateEffect(type: MatterType): ProjectileEffect {
  return {
    mode: FireMode.CREATE,
    createType: type,
    instantProjectileCollidesWith: MatterTypeSet.excluding(...CREATE_PROJECTILE_PASSTHROUGH),
  }
}

export const PROJECTILE_EFFECT = {
  CREATE_SOLID: makeCreateEffect(SOLID),
  CREATE_SAND: makeCreateEffect(SAND),
  CREATE_WATER: makeCreateEffect(WATER),
  CREATE_ACID: makeCreateEffect(ACID),
  CREATE_LAVA: makeCreateEffect(LAVA),
  CREATE_GUNPOWDER: makeCreateEffect(GUNPOWDER),

  DESTROY: {
    mode: FireMode.DESTROY,
    instantProjectileCollidesWith: MatterTypeSet.excluding(INDESTRUCTIBLE_TYPES, EMPTY, WATER, FIRE),
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
  [SOLID]: PROJECTILE_EFFECT.CREATE_SOLID,
  [SAND]: PROJECTILE_EFFECT.CREATE_SAND,
  [WATER]: PROJECTILE_EFFECT.CREATE_WATER,
  [ACID]: PROJECTILE_EFFECT.CREATE_ACID,
  [LAVA]: PROJECTILE_EFFECT.CREATE_LAVA,
  [GUNPOWDER]: PROJECTILE_EFFECT.CREATE_GUNPOWDER,
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
