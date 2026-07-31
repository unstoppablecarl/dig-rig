import {
  ACID,
  BURNING_FUEL,
  BURNING_THERMITE,
  C4,
  CHILLED_ICE,
  CONCRETE,
  CRYO,
  EMPTY,
  FALLING_WAX,
  FIRE,
  FUSE,
  GUNPOWDER,
  ICE,
  isSettled,
  LAVA,
  LAVA_DROP,
  type MatterAction,
  type MatterDef,
  matterType,
  MatterType,
  MatterTypeValues,
  type MatterValue,
  METHANE,
  NAPALM,
  NITRO,
  OIL,
  PERMANENT,
  PHYSICS_BODY,
  PLANT,
  ROCK,
  SALT,
  SALT_WATER,
  SAND,
  SOLID,
  STEAM,
  SUPPORT_MASK,
  SUPPORT_SHIFT,
  SupportType,
  THERMITE,
  WATER,
  WAX,
} from './_Matter.types.ts'
import { FILL_MAX } from './_Liquid.constants.ts'
import { MatterTypeSet } from './data/MatterTypeSet.ts'

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

export type HasOwnerIdTypes = {
  [K in keyof MatterMetaRegistry]: MatterMetaRegistry[K] extends { hasOwnerId: true } ? K : never
}[keyof MatterMetaRegistry]

export type NonOwnerIdTypes = Exclude<MatterType, HasOwnerIdTypes>

const IMMUTABLE_SUPPORT_TYPES = new Uint32Array(256)

// IMMUTABLE_SUPPORT_TYPES[type] is SupportType.NONE (0, the array's default) for any type that
// never registered an immutableSupport override, which doubles as "read from per-tile bits instead".
export function getSupportType(raw: number): SupportType {
  const override = IMMUTABLE_SUPPORT_TYPES[raw & 0xFF]
  return override !== SupportType.NONE ? override : (raw >>> SUPPORT_SHIFT) & 0b11
}

export function getImmutableSupportTypeOrFail(raw: number): SupportType {
  const type = matterType(raw)
  const supportType = IMMUTABLE_SUPPORT_TYPES[type]
  if (supportType === SupportType.NONE) {
    throw new Error(`Matter Type: "${MatterType[type]}" is not immutable"`)
  }
  return supportType
}

export function getImmutableSupportType(type: number): SupportType {
  return IMMUTABLE_SUPPORT_TYPES[type]
}

// Maps structural types to the type they convert to on island collapse (undefined = keep same type).
export const STRUCTURAL_COLLAPSE_TO: Partial<Record<MatterType, MatterType>> = {}

export const SINKS_THROUGH: Partial<Record<MatterType, MatterTypeSet>> = {}

// Types whose creation reserves destroy-charge against the creating tank (lava, acid, ...).
export const RESERVED_DESTROY_CHARGE = new MatterTypeSet()
const RESERVE_DESTROY_AMOUNT: Partial<Record<MatterType, number>> = {}
export const getReserveDestroyAmount = (type: MatterType) => RESERVE_DESTROY_AMOUNT[type] ?? 0

const enum Flag {
  SETTLES = 1 << 0,
  LAVA_BURNABLE = 1 << 1,
  ACID_MELTABLE = 1 << 2,
  LIQUID = 1 << 3,
  COLLIDES_WHEN_SETTLED = 1 << 4,
  ALWAYS_ACTIVE = 1 << 5,
  ALWAYS_COLLIDES = 1 << 6,
  HAS_OWNER_ID = 1 << 7,
  IMMUTABLE_SUPPORT_TYPE = 1 << 8,
  NO_CREATE_PROJECTILE_COLLISION = 1 << 9,
  NO_DESTROY_PROJECTILE_COLLISION = 1 << 10,
  CLUMPS = 1 << 11,
  LAVA_MELTABLE = 1 << 12,
}

export const INDESTRUCTIBLE_TYPES = new MatterTypeSet(PERMANENT, PHYSICS_BODY)

const MATTER_FLAGS = new Uint32Array(256)
export const isAlwaysActive = (type: MatterType) => (MATTER_FLAGS[type] & Flag.ALWAYS_ACTIVE) !== 0
export const doesSettle = (type: MatterType): type is SettlingTypes => (MATTER_FLAGS[type] & Flag.SETTLES) !== 0
export const isLavaBurnable = (type: MatterType) => (MATTER_FLAGS[type] & Flag.LAVA_BURNABLE) !== 0
export const isLavaMeltable = (type: MatterType) => (MATTER_FLAGS[type] & Flag.LAVA_MELTABLE) !== 0
// Skips direct ignite-to-FIRE conversion (lava's burn loop, lava-drop contact) — independent of
// lavaMeltable, since a meltable-but-not-burnable type (SOLID) is still immune to burning and is
// destroyed only through its own separate melt path.
export const isLavaImmune = (type: MatterType) => !isLavaBurnable(type)
export const isAcidMeltable = (type: MatterType) => (MATTER_FLAGS[type] & Flag.ACID_MELTABLE) !== 0
export const isAcidImmune = (type: MatterType) => !isAcidMeltable(type)
export const collidesWhenSettled = (type: MatterType) => (MATTER_FLAGS[type] & Flag.COLLIDES_WHEN_SETTLED) !== 0
export const isLiquid = (type: MatterType): type is LiquidTypes => (MATTER_FLAGS[type] & Flag.LIQUID) !== 0
export const isActivatable = (type: MatterType) => (MATTER_FLAGS[type] & (Flag.ALWAYS_ACTIVE | Flag.SETTLES)) !== 0
export const canHaveOwner = (type: MatterType): type is HasOwnerIdTypes => (MATTER_FLAGS[type] & Flag.HAS_OWNER_ID) !== 0
export const isClumpingLiquid = (type: MatterType) => (MATTER_FLAGS[type] & Flag.CLUMPS) !== 0
export const alwaysCollides = (type: MatterType) => (MATTER_FLAGS[type] & Flag.ALWAYS_COLLIDES) !== 0
export const isSupportTypeImmutable = (type: MatterType) => (MATTER_FLAGS[type] & Flag.IMMUTABLE_SUPPORT_TYPE) !== 0
export const collidesWithCreateProjectiles = (type: MatterType) => (MATTER_FLAGS[type] & Flag.NO_CREATE_PROJECTILE_COLLISION) === 0
export const collidesWithDestroyProjectiles = (type: MatterType) => (MATTER_FLAGS[type] & Flag.NO_DESTROY_PROJECTILE_COLLISION) === 0
export const isAlwaysStructural = (type: MatterType) => IMMUTABLE_SUPPORT_TYPES[type] === SupportType.STRUCTURAL

export const isDestructible = (type: MatterType) => !INDESTRUCTIBLE_TYPES.has(type)

// Fill-unit contribution of a single tile toward the global matter-conservation total (see
// Coordinator.computeMatterTotal, which this must stay in sync with). FIRE/BURNING_FUEL/
// PHYSICS_BODY don't represent conserved matter; liquids and steam are valued by their actual
// fill; everything else solid counts as one full tile (FILL_MAX).
export function matterFillContribution(raw: MatterValue, fillVal: number): number {
  if (raw === EMPTY) return 0
  const t = matterType(raw)
  if (isLiquid(t) || t === STEAM) return fillVal
  if (t !== FIRE && t !== PHYSICS_BODY && t !== BURNING_FUEL) return FILL_MAX
  return 0
}

const noop = () => {
}

function registerMatterType(
  {
    id,
    name,
    action = noop,
    immutableSupport,
    lavaBurnable = false,
    lavaMeltable = false,
    acidMeltable = false,
    clumps = false,
    collidesWhenSettled = false,
    liquid = false,
    hasOwnerId = false,
    settles = false,
    alwaysActive = false,
    alwaysCollides = false,
    collidesWithCreateProjectiles = true,
    collidesWithDestroyProjectiles = true,
    sinksThrough,
    structuralCollapseType,
    reserveDestroyAmount,
  }: MatterDef) {

  MATTER_ACTIONS[id] = action
  MATTER_NAMES.set(id, name)

  if (immutableSupport !== undefined) {
    IMMUTABLE_SUPPORT_TYPES[id] = immutableSupport
    MATTER_FLAGS[id] |= Flag.IMMUTABLE_SUPPORT_TYPE
  }

  if (lavaBurnable) MATTER_FLAGS[id] |= Flag.LAVA_BURNABLE
  if (lavaMeltable) MATTER_FLAGS[id] |= Flag.LAVA_MELTABLE
  if (acidMeltable) MATTER_FLAGS[id] |= Flag.ACID_MELTABLE
  if (clumps) MATTER_FLAGS[id] |= Flag.CLUMPS
  if (settles) MATTER_FLAGS[id] |= Flag.SETTLES
  if (alwaysActive) MATTER_FLAGS[id] |= Flag.ALWAYS_ACTIVE
  if (liquid) MATTER_FLAGS[id] |= Flag.LIQUID
  if (collidesWhenSettled) MATTER_FLAGS[id] |= Flag.COLLIDES_WHEN_SETTLED
  if (alwaysCollides) MATTER_FLAGS[id] |= Flag.ALWAYS_COLLIDES
  if (!collidesWithCreateProjectiles) MATTER_FLAGS[id] |= Flag.NO_CREATE_PROJECTILE_COLLISION
  if (!collidesWithDestroyProjectiles) MATTER_FLAGS[id] |= Flag.NO_DESTROY_PROJECTILE_COLLISION
  if (hasOwnerId) MATTER_FLAGS[id] |= Flag.HAS_OWNER_ID

  if (sinksThrough) SINKS_THROUGH[id] = new MatterTypeSet(...sinksThrough)
  if (structuralCollapseType !== undefined) STRUCTURAL_COLLAPSE_TO[id] = structuralCollapseType
  if (reserveDestroyAmount !== undefined) {
    RESERVE_DESTROY_AMOUNT[id] = reserveDestroyAmount
    RESERVED_DESTROY_CHARGE.add(id)
  }
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

export function convertsToCollisionBody(value: number): boolean {
  const type = matterType(value)
  if (alwaysCollides(type)) return true
  if (isSettled(value)) return collidesWhenSettled(type)
  return false
}

export const CRYO_STICKS_TO = new MatterTypeSet(...MatterTypeValues.filter(v => {
  return !isLiquid(v) && getImmutableSupportType(v) !== SupportType.NONE
}))

export const CRYO_STICKS_TO_IF_SETTLED = new MatterTypeSet(...MatterTypeValues.filter(v => {
  return !isLiquid(v) && doesSettle(v)
}))

export const MATTER_ICONS: Record<MatterType, string> = {
  [EMPTY]: '❌',
  [SOLID]: '🧱',
  [PERMANENT]: '🔒',
  [SAND]: '🏝️',
  [WATER]: '💧',
  [FIRE]: '🔥',
  [OIL]: '🛢️',
  [LAVA]: '🌋',
  [ROCK]: '🪨',
  [STEAM]: '🌧️',
  [METHANE]: '☁️',
  [SALT]: '🧂',
  [SALT_WATER]: '🌊',
  [CONCRETE]: '🪣',
  [PLANT]: '🌿',
  [FUSE]: '🧨',
  [WAX]: '🕯',
  [FALLING_WAX]: '🕯️',
  [NITRO]: '🏎️',
  [NAPALM]: '💣',
  [C4]: '💣',
  [ICE]: '🧊',
  [CHILLED_ICE]: '❄️',
  [CRYO]: '🥶',
  [ACID]: '👩‍🔬',
  [THERMITE]: '🌡️',
  [BURNING_THERMITE]: '🔥',
  [GUNPOWDER]: '💣',
  [LAVA_DROP]: '🩸',
  [BURNING_FUEL]: '🎇',
  [PHYSICS_BODY]: '⧅',
}

export const ACID_DESTROYABLE = new MatterTypeSet(...MatterTypeValues.filter(v => isAcidMeltable(v)))
export const LAVA_DESTROYABLE = new MatterTypeSet(...MatterTypeValues.filter(v => isLavaBurnable(v) || isLavaMeltable(v)))
