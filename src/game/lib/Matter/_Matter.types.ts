import type { MatterSim } from '../MatterEngine/workers/MatterSim/MatterSim.ts'
import { type MatterTankId, NO_MATTER_TANK_ID } from './Tank/_MatterTank.types.ts'

/* Matter Value Encoding
 * matter type: int - bits 0-7 = (8 bits, 0–255)
 * settled: boolean - bit 8 = (1 bit, 0-1)
 * owner id: int - bits 9–16  (8 bits, 0–255)
 * support type: int - bits 17–18 (2 bits, 0-3)
 *
 * matter specific:
 * LAVA_DROP velocity: int - bits 27–30 (16 bits, 0-15)
 * encode remaining upward ticks for in-flight lava drops.  0 = falling, 1–15 = remaining upward steps.
 *
 * */

// SETTLED_FLAG — bit 8 of a tile value. Set when an matterType has stopped moving
// and been removed from the active set. Cleared on disturbance to re-activate it.
//   tile = SAND | SETTLED_FLAG   → settled sand (0x103)
//   tile & SETTLED_FLAG !== 0    → is this tile settled?
//   tile & ~SETTLED_FLAG         → strip settled, get raw tile back
export const SETTLED_FLAG = 0x100

// TYPE_MASK — isolates the matterType ID from bits 0–7, ignoring settled and owner bits.
//   tile & TYPE_MASK             → base MatterType (0–255)
//   tile & TYPE_MASK === WATER   → is this tile water, settled or not?
export const TYPE_MASK = 0xFF
//   TILE_STATE_MASK — type + settled bits only; strips owner and any upper bits.
//   tile & TILE_STATE_MASK → safe index into a 512-entry type+settled table
export const TILE_STATE_MASK = TYPE_MASK | SETTLED_FLAG  // 0x1FF

// OWNER_MASK / OWNER_SHIFT — bits 9–16 hold the owner ID (8 bits, 1–255; 0 = world/unowned).
//   (tile >>> OWNER_SHIFT) & 0xFF              → owner ID as integer
//   (tile & ~OWNER_MASK) | (id << OWNER_SHIFT) → write owner ID into a tile
//   tile & ~OWNER_MASK                         → strip owner, keep type + settled
export const OWNER_SHIFT = 9
export const OWNER_MASK = 0xFF << OWNER_SHIFT  // 0x1FE00

// setSettled — sets or clears SETTLED_FLAG, leaving all other bits intact.
export function setSettled(value: MatterValue, settled: boolean): MatterRaw {
  return (settled ? (value | SETTLED_FLAG) : (value & ~SETTLED_FLAG)) as MatterRaw
}

export function isSettled(value: MatterValue): boolean {
  return (value & SETTLED_FLAG) !== 0
}

// setOwner — writes `owner` into bits 9–24, leaving type and settled bits intact.
export function setOwner(value: MatterValue, owner: MatterTankId): number {
  return (value & ~OWNER_MASK) | ((owner & 0xFF) << OWNER_SHIFT)
}

// getOwner — extracts the owner ID from bits 9–24 (0 = unowned/world).
export function getOwner(value: MatterValue): MatterTankId {
  return ((value >>> OWNER_SHIFT) & 0xFF) as MatterTankId
}

export function getFirstOwnerId(value1: MatterValue, value2: MatterValue) {
  const first = getOwner(value1)
  if (first !== NO_MATTER_TANK_ID) {
    return first
  }
  return getOwner(value2)
}

// clearOwner — sets the owner field to 0 (NONE), leaving type and settled bits intact.
export function clearOwner(value: MatterValue): MatterRaw {
  return (value & ~OWNER_MASK) as MatterRaw
}

// LAVA_DROP velocity — bits 27–30 encode remaining upward ticks for in-flight lava drops.
//   0 = falling, 1–15 = remaining upward steps.
export const LAVA_DROP_VEL_SHIFT = 27
export const LAVA_DROP_VEL_MASK = 0xF << 27  // 0x78000000, bits 27–30

export function getLavaDropVel(tile: MatterValue): number {
  return (tile >>> LAVA_DROP_VEL_SHIFT) & 0xF
}

export function setLavaDropVel(tile: MatterValue, vel: number): MatterRaw {
  return ((tile & ~LAVA_DROP_VEL_MASK) | ((vel & 0xF) << LAVA_DROP_VEL_SHIFT)) as MatterRaw
}

// COUNTER — 8-bit field in bits 19–26. Shared by mutually exclusive tile types:
//   Fuel tiles (PLANT, OIL, FUSE): burn countdown; 0 = not burning, 1–255 = ticks remaining
//   FIRE tiles: age countdown; 0 = freshly placed (initialized on first tick), 1–255 = ticks remaining
export const COUNTER_SHIFT = 19
export const COUNTER_MASK = 0xFF << COUNTER_SHIFT

export function getCounter(tile: MatterValue): number {
  return (tile >>> COUNTER_SHIFT) & 0xFF
}

export function setCounter(tile: MatterValue, count: number): MatterRaw {
  return ((tile & ~COUNTER_MASK) | ((count & 0xFF) << COUNTER_SHIFT)) as MatterRaw
}

export function hasCounter(tile: MatterValue): boolean {
  return (tile & COUNTER_MASK) !== 0
}

// base ticks before fire self-extinguishes (−0 to −5 random)
export const FIRE_INIT_AGE = 20
export const PLANT_BURN_TICKS = 10
export const OIL_BURN_TICKS = 6
export const FUSE_BURN_TICKS = 3

// SUPPORT_TYPE — 2-bit field in bits 17–18. Encodes how a tile relates to structural
// physics. Higher values dominate: anchored > structural > affixed > none.
//
//   none (0)       — normal physics; falls, flows, or is empty
//   affixed (1)    — stays in place but plays no structural role (fuse, ice, c4, plant)
//   structural (2) — held up by island connectivity; collapses to powder if disconnected
//   anchored (3)   — immovable root; never collapses (permanent tiles, level terrain)
//
// Per-tile bits are IGNORED for types registered with alwaysSupport — their support type
// is enforced at read-time by getSupportType() in matter.ts via ALWAYS_* sets.
// setAnchored / setSupportBits only manipulate the per-tile bits.
export const SUPPORT_SHIFT = 17
export const SUPPORT_MASK = 0b11 << SUPPORT_SHIFT  // 0x60000

export const enum SupportType {
  NONE = 0,
  AFFIXED = 1,
  STRUCTURAL = 2,
  ANCHORED = 3,
}

// getSupportBits — reads only the raw per-tile bits; does NOT apply ALWAYS_* overrides.
// Use getSupportType() from matter.ts for correct type-safe reads.
export function getSupport(target: MatterValue): SupportType {
  return (target >>> SUPPORT_SHIFT) & 0b11
}

// extracts MatterType
export function matterType(value: MatterValue): MatterType {
  return (value & TYPE_MASK) as MatterType
}

export enum MatterType {
  EMPTY = 0,
  SOLID = 1,
  PERMANENT = 2,
  SAND = 3,
  WATER = 5,
  FIRE = 6,
  OIL = 7,
  LAVA = 8,
  ROCK = 9,
  STEAM = 10,
  METHANE = 11,
  SALT = 12,
  SALT_WATER = 13,
  CONCRETE = 14,
  PLANT = 15,
  FUSE = 16,
  WAX = 17,
  FALLING_WAX = 18,
  NITRO = 19,
  NAPALM = 20,
  C4 = 21,
  ICE = 22,
  CHILLED_ICE = 23,
  CRYO = 24,
  ACID = 25,
  THERMITE = 26,
  BURNING_THERMITE = 27,
  GUNPOWDER = 28,
  LAVA_DROP = 29,
  BURNING_FUEL = 30,
  PHYSICS_BODY = 31,
}

export const EMPTY = MatterType.EMPTY
export const SOLID = MatterType.SOLID
export const PERMANENT = MatterType.PERMANENT
export const SAND = MatterType.SAND
export const WATER = MatterType.WATER
export const FIRE = MatterType.FIRE
export const OIL = MatterType.OIL
export const LAVA = MatterType.LAVA
export const ROCK = MatterType.ROCK
export const STEAM = MatterType.STEAM
export const METHANE = MatterType.METHANE
export const SALT = MatterType.SALT
export const SALT_WATER = MatterType.SALT_WATER
export const CONCRETE = MatterType.CONCRETE
export const PLANT = MatterType.PLANT
export const FUSE = MatterType.FUSE
export const WAX = MatterType.WAX
export const FALLING_WAX = MatterType.FALLING_WAX
export const NITRO = MatterType.NITRO
export const NAPALM = MatterType.NAPALM
export const C4 = MatterType.C4
export const ICE = MatterType.ICE
export const CHILLED_ICE = MatterType.CHILLED_ICE
export const CRYO = MatterType.CRYO
export const ACID = MatterType.ACID
export const THERMITE = MatterType.THERMITE
export const BURNING_THERMITE = MatterType.BURNING_THERMITE
export const GUNPOWDER = MatterType.GUNPOWDER
export const LAVA_DROP = MatterType.LAVA_DROP
export const BURNING_FUEL = MatterType.BURNING_FUEL
export const PHYSICS_BODY = MatterType.PHYSICS_BODY

export const MatterTypeValues = Object.values(MatterType).filter(
  (k) => !isNaN(Number(k)),
) as MatterType[]

export const MatterTypeKeyValues = Object.fromEntries(
  MatterTypeValues.map((key) => [MatterType[key as any], key]),
)

export type MatterAction = (world: MatterSim, x: number, y: number, idx: number) => void

export type MatterDef = {
  id: MatterType
  name: string
  action?: MatterAction
  // alwaysSupport — immutable support type enforced at read-time regardless of per-tile bits.
  immutableSupport?: SupportType.ANCHORED | SupportType.STRUCTURAL | SupportType.AFFIXED
  lavaImmune?: boolean
  acidImmune?: boolean
  // whether this liquid prefers to consolidate into an already-full same-type
  // neighbor (top it off toward FILL_MAX) instead of even nearest-neighbor
  // diffusion — lava/acid only; water-like liquids look fine spreading evenly.
  clumps?: boolean
  liquid?: boolean
  settles?: boolean,
  alwaysActive?: boolean,
  alwaysCollides?: boolean,
  hasOwnerId?: boolean,
  collidesWhenSettled?: boolean
  // whether an in-flight CREATE-mode projectile stops on contact with this type. Defaults to
  // true; transient types like lava drops and gases should pass through instead of detonating.
  collidesWithCreateProjectiles?: boolean
  // whether an in-flight DESTROY-mode projectile stops on contact with this type. Defaults to
  // true; EMPTY and PHYSICS_BODY pass through.
  collidesWithDestroyProjectiles?: boolean
  sinksThrough?: MatterType[]
  // what the tile converts to when its structural island collapses (undefined = keep type).
  structuralCollapseType?: MatterType
  // units of destroy-charge to reserve against the creating tank per tile of this type created —
  // the amount of matter this type will eventually return to its owner's tank when it self-destructs.
  reserveDestroyAmount?: number
}

// an encoded number value for a single tile
export type MatterRaw = number & { readonly __brandMatterRaw: unique symbol; }
export type MatterValue = MatterRaw | number

