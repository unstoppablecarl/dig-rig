// Bit 7 (0x80) marks a settled element — same type, no longer in activeSet.
// Bits 0-6 (TYPE_MASK) hold the element id (0–127, max 128 elements).
export const SETTLED_FLAG = 0x80
export const TYPE_MASK = 0x7F

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

// Settled-state constants (type | SETTLED_FLAG); not in enum so they don't
// appear in MatterTypeValues and don't pollute the mask texture lookup table.
export const SAND_SETTLED = MatterType.SAND | SETTLED_FLAG  // 0x83
export const WATER_SETTLED = MatterType.WATER | SETTLED_FLAG  // 0x85

// Short-hand re-exports (matches project-sand naming used across element files)
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
