export enum FireMode {
  CREATE,
  DESTROY,
  SOLIDIFY,
  MELT,
}

export const FireModeValues = Object.values(FireMode).filter((key) => !isNaN(Number(key))) as FireMode[]
export type MatterTankFireMode = FireMode.CREATE | FireMode.DESTROY;