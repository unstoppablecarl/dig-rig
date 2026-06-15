// SETTLED_FLAG — bit 8 of a tile value. Set when an matterType has stopped moving
// and been removed from the active set. Cleared on disturbance to re-activate it.
//   tile = SAND | SETTLED_FLAG   → settled sand (0x103)
//   tile & SETTLED_FLAG !== 0    → is this tile settled?
//   tile & ~SETTLED_FLAG         → strip settled, get raw tile back

import type { MatterAction } from './matter.ts'
import { type MatterTankId, NO_MATTER_TANK_ID } from './MatterTank/_MatterTank.types.ts'

export const SETTLED_FLAG = 0x100

// TYPE_MASK — isolates the matterType ID from bits 0–7, ignoring settled and owner bits.
//   tile & TYPE_MASK             → base MatterType (0–255)
//   tile & TYPE_MASK === WATER   → is this tile water, settled or not?
export const TYPE_MASK = 0xFF
//   TILE_STATE_MASK — type + settled bits only; strips owner and any upper bits.
//   tile & TILE_STATE_MASK → safe index into a 512-entry type+settled table
export const TILE_STATE_MASK = TYPE_MASK | SETTLED_FLAG  // 0x1FF

// OWNER_MASK / OWNER_SHIFT — bits 9–24 hold the owner ID (16 bits, 1–65535; 0 = world/unowned).
//   (tile >>> OWNER_SHIFT) & 0xFFFF            → owner ID as integer
//   (tile & ~OWNER_MASK) | (id << OWNER_SHIFT) → write owner ID into a tile
//   tile & ~OWNER_MASK                         → strip owner, keep type + settled
export const OWNER_SHIFT = 9
export const OWNER_MASK = 0xFFFF << OWNER_SHIFT  // 0x1FFFE00

// setSettled — sets or clears SETTLED_FLAG, leaving all other bits intact.
export function setSettled(value: number, settled: boolean): number {
  return settled ? (value | SETTLED_FLAG) : (value & ~SETTLED_FLAG)
}

export function isSettled(value: number): boolean {
  return (value & SETTLED_FLAG) !== 0
}

// setOwner — writes `owner` into bits 9–24, leaving type and settled bits intact.
export function setOwner(value: number, owner: MatterTankId): number {
  return (value & ~OWNER_MASK) | ((owner & 0xFFFF) << OWNER_SHIFT)
}

// getOwner — extracts the owner ID from bits 9–24 (0 = unowned/world).
export function getOwner(value: number): MatterTankId {
  return ((value >>> OWNER_SHIFT) & 0xFFFF) as MatterTankId
}

export function getFirstOwnerId(value1: number, value2: number) {
  const first = getOwner(value1)
  if (first !== NO_MATTER_TANK_ID) {
    return first
  }
  return getOwner(value2)
}

// clearOwner — sets the owner field to 0 (NONE), leaving type and settled bits intact.
export function clearOwner(value: number): number {
  return value & ~OWNER_MASK
}

// ANCHORED_FLAG — bit 25. Marks a tile as an immovable anchor regardless of type;
// treated as equivalent to PERMANENT for structural-connectivity purposes.
// Must be set/cleared explicitly — not maintained automatically by the simulation.
export const ANCHORED_FLAG = 0x2000000

export function setAnchored(value: number, anchored: boolean): number {
  return anchored ? (value | ANCHORED_FLAG) : (value & ~ANCHORED_FLAG)
}

export function isAnchored(value: number): boolean {
  return (value & ANCHORED_FLAG) !== 0
}

// STRUCTURAL_FLAG — bit 26. Per-tile opt-in structural marker.
// Types listed in ConditionallyStructuralType can have this set to participate in
// island detection without being always-structural. TypeScript enforces valid types
// at call sites via the setStructural signature; no runtime registry is needed.
export const STRUCTURAL_FLAG = 0x4000000

export function setStructuralFlag(target: number, value: boolean): number {
  return value ? (target | STRUCTURAL_FLAG) : (target & ~STRUCTURAL_FLAG)
}

export function isStructuralFlag(value: number): boolean {
  return (value & STRUCTURAL_FLAG) !== 0
}

// extracts MatterType
export function matterType(value: number): MatterType {
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

export const MatterTypeValues = Object.values(MatterType).filter(
  (k) => !isNaN(Number(k)),
) as MatterType[]

export const MatterTypeKeyValues = Object.fromEntries(
  MatterTypeValues.map((key) => [MatterType[key as any], key]),
)

export type MatterDef = {
  id: MatterType
  name: string
  action?: MatterAction
  passive?: boolean
  lavaImmune?: boolean
  acidImmune?: boolean
  liquid?: boolean
  settles?: boolean,
  hasOwnerId?: boolean,
  collidesWhenSettled?: boolean
  sinksThrough?: MatterType[]
  // type always participates in island detection (e.g. SOLID, WAX).
  alwaysStructural?: boolean
  // what the tile converts to when it is in a structural state and its island collapses.
  // stays the same type if not set
  structuralCollapseType?: MatterType
}