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

export class PlayerFireGroupState {
  private index = 0
  private fireGroup: FireGroup

  constructor(mode: FireGroup = FireGroup.CREATE_DESTROY) {
    this.set(mode)
  }

  value(): FireGroup {
    return this.fireGroup
  }

  primary():FireMode {
    return FireGroupModes[this.fireGroup].PRIMARY
  }

  secondary(): FireMode {
    return FireGroupModes[this.fireGroup].SECONDARY
  }

  set(fireGroup: FireGroup) {
    this.fireGroup = fireGroup
    this.index = FireGroupValues.indexOf(fireGroup)
  }

  prev() {
    let index: number
    if (this.index === 0) {
      index = FireGroupValues.length - 1
    } else {
      index = this.index - 1
    }
    this.set(FireGroupValues[index])
    return this.fireGroup
  }

  next() {
    let index: number
    if (this.index === FireGroupValues.length - 1) {
      index = 0
    } else {
      index = this.index + 1
    }
    this.set(FireGroupValues[index])
    return this.fireGroup
  }
}