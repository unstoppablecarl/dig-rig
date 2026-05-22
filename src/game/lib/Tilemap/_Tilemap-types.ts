export enum TerrainType {
  EMPTY = 0,
  SOLID = 1,
  PERMANENT = 2,
}

export const TerrainTypeValues = Object.values(TerrainType).filter((key) => !isNaN(Number(key))) as TerrainType[]
