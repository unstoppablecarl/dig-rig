import { FireMode, FireModeValues } from '../../config.ts'

export class PlayerFireModeState {
  private index = 0
  private _fireMode: FireMode

  constructor(mode: FireMode = FireMode.DESTROY) {
    this.set(mode)
  }

  value() {
    return this._fireMode
  }

  set(fireMode: FireMode) {
    this._fireMode = fireMode
    this.index = FireModeValues.indexOf(fireMode)
  }

  prev() {
    let index: number
    if (this.index === 0) {
      index = FireModeValues.length - 1
    } else {
      index = this.index - 1
    }
    this.set(FireModeValues[index])
    return this._fireMode
  }

  next() {
    let index: number
    if (this.index === FireModeValues.length - 1) {
      index = 0
    } else {
      index = this.index + 1
    }
    this.set(FireModeValues[index])
    return this._fireMode
  }
}