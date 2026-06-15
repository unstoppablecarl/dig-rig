import {
  EMPTY,
  isSettled,
  isStructuralFlag,
  MatterType,
  matterType,
  PERMANENT,
  setStructuralFlag,
  SOLID,
} from './_Matter.types.ts'
import { MatterTypeSet } from './data/MatterTypeSet'
import type { MatterSim } from './MatterSim.ts'

export type MatterAction = (world: MatterSim, x: number, y: number, idx: number) => void

export type MatterDef = {
  name: string
  action?: MatterAction
  passive?: boolean
  lavaImmune?: boolean
  acidImmune?: boolean
  liquid?: boolean
  settles?: boolean,
  collidesWhenSettled?: boolean
  sinksThrough?: MatterType[]
  // type always participates in island detection (e.g. SOLID, WAX).
  alwaysStructural?: boolean
  // what the tile converts to when it is in a structural state and its island collapses.
  // stays the same type if not set
  structuralCollapseType?: MatterType
}

export interface MatterMetaRegistry {
}

export const MATTER_ACTIONS: MatterAction[] = []
export const MATTER_NAMES = new Map<MatterType, string>()
export const SETTLING_TYPES = new MatterTypeSet()
export type SettlingTypes = {
  [K in keyof MatterMetaRegistry]: MatterMetaRegistry[K] extends { settles: true } ? K : never;
}[keyof MatterMetaRegistry];

export const PASSIVE_MATER_TYPES = new MatterTypeSet()
export type PassivMatterTypes = {
  [K in keyof MatterMetaRegistry]: MatterMetaRegistry[K] extends { passive: true } ? K : never
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

// Types that are always structural (structural: true in MatterDef).
export const ALWAYS_STRUCTURAL = new MatterTypeSet()
export type MatterAlwaysStructuralTypes = {
  [K in keyof MatterMetaRegistry]: MatterMetaRegistry[K] extends { alwaysStructural: true } ? K : never
}[keyof MatterMetaRegistry]

// Maps structural types to the type they convert to on island collapse (undefined = keep same type).
export const STRUCTURAL_COLLAPSE_TO: Partial<Record<MatterType, MatterType>> = {}
// True if this raw tile value participates in structural island detection:
// either its type is always-structural, or it has STRUCTURAL_FLAG set (per-tile opt-in).
export function isStructural(raw: number): boolean {
  return ALWAYS_STRUCTURAL.has(matterType(raw)) || isStructuralFlag(raw)
}

export const SINKS_THROUGH: Partial<Record<MatterType, MatterTypeSet>> = {}

export function setStructural(target: number, value: boolean): number {
  if (import.meta.env.DEV) {
    const type = matterType(target)
    if (type === EMPTY || ALWAYS_STRUCTURAL.has(type)) {
      throw new Error(`Cannot set ${MatterType[type]} structural flag it is immutable.`)
    }
  }
  return setStructuralFlag(target, value)
}

// always counts as settled
export function isSolid(value: number) {
  const type = matterType(value)
  return type === SOLID || type === PERMANENT || isSettled(value)
}

const noop = () => {
}

export function registerMatterType(id: MatterType, {
  name,
  action = noop,
  passive = false,
  lavaImmune = false,
  acidImmune = false,
  collidesWhenSettled = false,
  liquid = false,
  sinksThrough,
  alwaysStructural,
  structuralCollapseType,
}: MatterDef) {
  MATTER_ACTIONS[id] = action
  MATTER_NAMES.set(id, name)

  if (passive) PASSIVE_MATER_TYPES.add(id)
  if (lavaImmune) LAVA_IMMUNE.add(id)
  if (acidImmune) ACID_IMMUNE.add(id)
  if (liquid) LIQUID_TYPES.add(id)
  if (collidesWhenSettled) COLLIDES_WHEN_SETTLED.add(id)
  if (sinksThrough) SINKS_THROUGH[id] = new MatterTypeSet(...sinksThrough)
  if (alwaysStructural) ALWAYS_STRUCTURAL.add(id)
  if (structuralCollapseType !== undefined) STRUCTURAL_COLLAPSE_TO[id] = structuralCollapseType
}
