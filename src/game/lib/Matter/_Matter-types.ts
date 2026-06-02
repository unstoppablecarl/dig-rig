export enum MatterType {
  EMPTY = 0,
  SOLID = 1,
  PERMANENT = 2,
  SAND = 3,
  SAND_SETTLED = 4,
  WATER = 5,
}

export const EMPTY = MatterType.EMPTY
export const SOLID = MatterType.SOLID
export const PERMANENT = MatterType.PERMANENT
export const SAND = MatterType.SAND
export const SAND_SETTLED = MatterType.SAND_SETTLED
export const WATER = MatterType.WATER

export const MatterTypeValues = Object.values(MatterType).filter((key) => !isNaN(Number(key))) as MatterType[]
export const MatterTypeKeyValues = Object.fromEntries(MatterTypeValues.map(key => [MatterType[key as any], key]))
