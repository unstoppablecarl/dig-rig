import type { MatterSim } from '../MatterEngine/workers/MatterSim/MatterSim.ts'
import {
  EMPTY,
  isSettled,
  type MatterDef,
  matterType,
  MatterType,
  SUPPORT_MASK,
  SUPPORT_SHIFT,
  SupportType,
} from './_Matter.types.ts'
import { MatterTypeSet } from './data/MatterTypeSet.ts'

export type MatterAction = (world: MatterSim, x: number, y: number, idx: number) => void

export interface MatterMetaRegistry {
}

export const MATTER_ACTIONS: MatterAction[] = []
export const MATTER_NAMES = new Map<MatterType, string>()
export type SettlingTypes = {
  [K in keyof MatterMetaRegistry]: MatterMetaRegistry[K] extends { settles: true } ? K : never;
}[keyof MatterMetaRegistry]

export type LiquidTypes = {
  [K in keyof MatterMetaRegistry]: MatterMetaRegistry[K] extends { liquid: true } ? K : never
}[keyof MatterMetaRegistry]

// 256-entry lookup: value is the fixed SupportType for that MatterType, or 0xFF = "read from tile bits".
const SUPPORT_TYPE_LOOKUP = new Uint8Array(256).fill(0xFF)

export function getSupportType(raw: number): SupportType {
  const override = SUPPORT_TYPE_LOOKUP[raw & 0xFF]
  return override !== 0xFF ? override : (raw >>> SUPPORT_SHIFT) & 0b11
}

const IMMUTABLE_SUPPORT_TYPES = new Uint32Array(256)

export function getImmutableSupportType(raw: number): SupportType {
  const type = matterType(raw)
  const supportType = IMMUTABLE_SUPPORT_TYPES[type]
  if (supportType === SupportType.NONE) {
    throw new Error(`Matter Type: "${MatterType[type]}" is not immutable"`)
  }
  return supportType
}

// Maps structural types to the type they convert to on island collapse (undefined = keep same type).
export const STRUCTURAL_COLLAPSE_TO: Partial<Record<MatterType, MatterType>> = {}

export const SINKS_THROUGH: Partial<Record<MatterType, MatterTypeSet>> = {}

const enum Flag {
  SETTLES = 1 << 0,
  LAVA_IMMUNE = 1 << 1,
  ACID_IMMUNE = 1 << 2,
  LIQUID = 1 << 3,
  COLLIDES_WHEN_SETTLED = 1 << 4,
  ALWAYS_ACTIVE = 1 << 5,
  ALWAYS_COLLIDES = 1 << 6,
  HAS_OWNER_ID = 1 << 7,
  IMMUTABLE_SUPPORT_TYPE = 1 << 8,
}

const MATTER_FLAGS = new Uint32Array(256)
export const isAlwaysActive = (type: MatterType) => (MATTER_FLAGS[type] & Flag.ALWAYS_ACTIVE) !== 0
export const doesSettle = (type: MatterType) => (MATTER_FLAGS[type] & Flag.SETTLES) !== 0
export const isLavaImmune = (type: MatterType) => (MATTER_FLAGS[type] & Flag.LAVA_IMMUNE) !== 0
export const isAcidImmune = (type: MatterType) => (MATTER_FLAGS[type] & Flag.ACID_IMMUNE) !== 0
export const collidesWhenSettled = (type: MatterType) => (MATTER_FLAGS[type] & Flag.COLLIDES_WHEN_SETTLED) !== 0
export const isLiquid = (type: MatterType) => (MATTER_FLAGS[type] & Flag.LIQUID) !== 0
export const isActivatable = (type: MatterType) => (MATTER_FLAGS[type] & (Flag.ALWAYS_ACTIVE | Flag.SETTLES)) !== 0
export const canHaveOwner = (type: MatterType) => (MATTER_FLAGS[type] & Flag.HAS_OWNER_ID) !== 0
export const alwaysCollides = (type: MatterType) => (MATTER_FLAGS[type] & Flag.ALWAYS_COLLIDES) !== 0
export const isSupportTypeImmutable = (type: MatterType) => (MATTER_FLAGS[type] & Flag.IMMUTABLE_SUPPORT_TYPE) !== 0
export const isAlwaysStructural = (type: MatterType) => (IMMUTABLE_SUPPORT_TYPES[type] & SupportType.STRUCTURAL) !== 0

const noop = () => {
}

function registerMatterType(
  {
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
    alwaysCollides = false,
    sinksThrough,
    structuralCollapseType,
  }: MatterDef) {

  MATTER_ACTIONS[id] = action
  MATTER_NAMES.set(id, name)

  if (immutableSupport !== undefined) {
    IMMUTABLE_SUPPORT_TYPES[id] = immutableSupport
    MATTER_FLAGS[id] |= Flag.IMMUTABLE_SUPPORT_TYPE
  }

  if (lavaImmune) MATTER_FLAGS[id] |= Flag.LAVA_IMMUNE
  if (acidImmune) MATTER_FLAGS[id] |= Flag.ACID_IMMUNE
  if (settles) MATTER_FLAGS[id] |= Flag.SETTLES
  if (alwaysActive) MATTER_FLAGS[id] |= Flag.ALWAYS_ACTIVE
  if (liquid) MATTER_FLAGS[id] |= Flag.LIQUID
  if (collidesWhenSettled) MATTER_FLAGS[id] |= Flag.COLLIDES_WHEN_SETTLED
  if (alwaysCollides) MATTER_FLAGS[id] |= Flag.ALWAYS_COLLIDES
  if (hasOwnerId) MATTER_FLAGS[id] |= Flag.HAS_OWNER_ID

  if (sinksThrough) SINKS_THROUGH[id] = new MatterTypeSet(...sinksThrough)
  if (structuralCollapseType !== undefined) STRUCTURAL_COLLAPSE_TO[id] = structuralCollapseType
}

const defs = import.meta.glob('./defs/*.ts', { eager: true }) as Record<string, { default: MatterDef }>

for (const mod of Object.values(defs)) {
  registerMatterType(mod.default)
}

export function setSupport(target: number, support: SupportType): number {
  if (import.meta.env.DEV) {
    const type = matterType(target)
    if (type === EMPTY || isSupportTypeImmutable(type)) {
      throw new Error(`Cannot set ${MatterType[type]} support bits — support type is immutable.`)
    }
  }
  return (target & ~SUPPORT_MASK) | (support << SUPPORT_SHIFT)
}

export function isCollidable(value: number): boolean {
  const type = matterType(value)
  if (alwaysCollides(type)) return true
  if (isSettled(value)) return collidesWhenSettled(type)
  return false
}
