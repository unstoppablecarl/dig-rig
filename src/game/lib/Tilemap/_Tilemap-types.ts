export enum MatterType {
  EMPTY = 0,
  SOLID = 1,
  PERMANENT = 2,
}

export const TerrainTypeValues = Object.values(MatterType).filter((key) => !isNaN(Number(key))) as MatterType[]
