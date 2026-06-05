import { FireMode } from './_FireMode-types'

export enum FireGroup {
  CREATE_DESTROY,
  SOLIDIFY_MELT,
}

export const FireGroupValues = Object.values(FireGroup).filter((key) => !isNaN(Number(key))) as FireGroup[]

export type FireGroupValue = {
  PRIMARY: FireMode
  SECONDARY: FireMode
}

export const FireGroupModes: Record<FireGroup, FireGroupValue> = {
  [FireGroup.CREATE_DESTROY]: {
    PRIMARY: FireMode.DESTROY,
    SECONDARY: FireMode.CREATE,
  },
  [FireGroup.SOLIDIFY_MELT]: {
    PRIMARY: FireMode.MELT,
    SECONDARY: FireMode.SOLIDIFY,
  },
}