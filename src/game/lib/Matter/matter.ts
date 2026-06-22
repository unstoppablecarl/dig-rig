import {
  EMPTY,
  type MatterDef,
  matterType,
  MatterType,
  SUPPORT_MASK,
  SUPPORT_SHIFT,
  SupportType,
} from './_Matter.types.ts'
import { MatterTypeSet } from './data/MatterTypeSet.ts'
import type { MatterSim } from '../MatterEngine/workers/MatterSim/MatterSim.ts'

export type MatterAction = (world: MatterSim, x: number, y: number, idx: number) => void

export interface MatterMetaRegistry {
}

export const MATTER_ACTIONS: MatterAction[] = []
export const MATTER_NAMES = new Map<MatterType, string>()
export const SETTLING_TYPES = new MatterTypeSet()
export const ALWAYS_ACTIVE_TYPES = new MatterTypeSet()
export type SettlingTypes = {
  [K in keyof MatterMetaRegistry]: MatterMetaRegistry[K] extends { settles: true } ? K : never;
}[keyof MatterMetaRegistry]

export const LAVA_IMMUNE = new MatterTypeSet()
export type LavaImmune = {
  [K in keyof MatterMetaRegistry]: MatterMetaRegistry[K] extends { lavaImmune: true } ? K : never
}[keyof MatterMetaRegistry]

export const ACID_IMMUNE = new MatterTypeSet()
export type AcidImmune = {
  [K in keyof MatterMetaRegistry]: MatterMetaRegistry[K] extends { acidImmune: true } ? K : never
}[keyof MatterMetaRegistry]

export const COLLIDES_WHEN_SETTLED = new MatterTypeSet()
export type CollidesWhenSettled = {
  [K in keyof MatterMetaRegistry]: MatterMetaRegistry[K] extends { collidesWhenSettled: true } ? K : never
}[keyof MatterMetaRegistry]

export const LIQUID_TYPES = new MatterTypeSet()
export type LiquidTypes = {
  [K in keyof MatterMetaRegistry]: MatterMetaRegistry[K] extends { liquid: true } ? K : never
}[keyof MatterMetaRegistry]

export const ALWAYS_ANCHORED = new MatterTypeSet()
export const ALWAYS_STRUCTURAL = new MatterTypeSet()
export const ALWAYS_AFFIXED = new MatterTypeSet()
export const SUPPORT_IMMUTABLE = new MatterTypeSet()

// 256-entry lookup: value is the fixed SupportType for that MatterType, or 0xFF = "read from tile bits".
const SUPPORT_TYPE_LOOKUP = new Uint8Array(256).fill(0xFF)

export type MatterAlwaysStructuralTypes = {
  [K in keyof MatterMetaRegistry]: MatterMetaRegistry[K] extends { alwaysSupport: 'structural' } ? K : never
}[keyof MatterMetaRegistry]

export function getSupportType(raw: number): SupportType {
  const override = SUPPORT_TYPE_LOOKUP[raw & 0xFF]
  return override !== 0xFF ? override : (raw >>> SUPPORT_SHIFT) & 0b11
}

export function getImmutableSupportType(raw: number): SupportType {
  const type = matterType(raw)
  if (ALWAYS_ANCHORED.has(type)) return SupportType.ANCHORED
  if (ALWAYS_STRUCTURAL.has(type)) return SupportType.STRUCTURAL
  if (ALWAYS_AFFIXED.has(type)) return SupportType.AFFIXED
  throw new Error(`Matter Type: "${MatterType[type]}" is not immutable"`)
}

// Maps structural types to the type they convert to on island collapse (undefined = keep same type).
export const STRUCTURAL_COLLAPSE_TO: Partial<Record<MatterType, MatterType>> = {}

export const SINKS_THROUGH: Partial<Record<MatterType, MatterTypeSet>> = {}

export const OWNED_MATTER_TYPES = new MatterTypeSet()
export type OwnedMatterTypes = {
  [K in keyof MatterMetaRegistry]: MatterMetaRegistry[K] extends { hasOwnerId: true } ? K : never
}[keyof MatterMetaRegistry]

const noop = () => {
}

function registerMatterType({
                              id,
                              name,
                              action = noop,
                              immutableSupport,
                              lavaImmune = false,
                              acidImmune = false,
                              collidesWhenSettled = false,
                              liquid = false,
                              hasOwnerId = false,
                              settles = false,
                              alwaysActive = false,
                              sinksThrough,
                              structuralCollapseType,
                            }: MatterDef) {

  MATTER_ACTIONS[id] = action
  MATTER_NAMES.set(id, name)
  if (immutableSupport === SupportType.ANCHORED) { ALWAYS_ANCHORED.add(id); SUPPORT_TYPE_LOOKUP[id] = SupportType.ANCHORED }
  else if (immutableSupport === SupportType.STRUCTURAL) { ALWAYS_STRUCTURAL.add(id); SUPPORT_TYPE_LOOKUP[id] = SupportType.STRUCTURAL }
  else if (immutableSupport === SupportType.AFFIXED) { ALWAYS_AFFIXED.add(id); SUPPORT_TYPE_LOOKUP[id] = SupportType.AFFIXED }
  if (immutableSupport !== undefined) SUPPORT_IMMUTABLE.add(id)
  if (lavaImmune) LAVA_IMMUNE.add(id)
  if (acidImmune) ACID_IMMUNE.add(id)
  if (liquid) LIQUID_TYPES.add(id)
  if (collidesWhenSettled) COLLIDES_WHEN_SETTLED.add(id)
  if (settles) SETTLING_TYPES.add(id)
  if (alwaysActive) ALWAYS_ACTIVE_TYPES.add(id)
  if (sinksThrough) SINKS_THROUGH[id] = new MatterTypeSet(...sinksThrough)
  if (structuralCollapseType !== undefined) STRUCTURAL_COLLAPSE_TO[id] = structuralCollapseType
  if (hasOwnerId) OWNED_MATTER_TYPES.add(id)
}

const defs = import.meta.glob('./defs/*.ts', { eager: true }) as Record<string, { default: MatterDef }>

for (const mod of Object.values(defs)) {
  registerMatterType(mod.default)
}

export const ACTIVATABLE_TYPES = SETTLING_TYPES.merge(ALWAYS_ACTIVE_TYPES)

export function setSupport(target: number, support: SupportType): number {
  if (import.meta.env.DEV) {
    const type = matterType(target)
    if (type === EMPTY || SUPPORT_IMMUTABLE.has(type)) {
      throw new Error(`Cannot set ${MatterType[type]} support bits — support type is immutable.`)
    }
  }
  return (target & ~SUPPORT_MASK) | (support << SUPPORT_SHIFT)
}
