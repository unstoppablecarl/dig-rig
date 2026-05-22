import { FireMode } from '../../config.ts'

const FIRE_MODES = Object.values(FireMode) as FireMode[]

export class PlayerFireModeState {
  private _fireMode: FireMode = FireMode.DESTROY
  private index = 0

  get fireMode() {
    return this._fireMode
  }

  setFireMode(fireMode: FireMode) {
    this._fireMode = fireMode
    this.index = FIRE_MODES.indexOf(fireMode)
  }

  prevFireMode() {
    let index: number
    if (this.index === 0) {
      index = FIRE_MODES.length - 1
    } else {
      index = this.index - 1
    }
    this.setFireMode(FIRE_MODES[index])
  }

  nextFireMode() {
    let index: number
    if (this.index === FIRE_MODES.length - 1) {
      index = 0
    } else {
      index = this.index + 1
    }
    this.setFireMode(FIRE_MODES[index])
  }
}