import { clampMaxInt } from '../../helpers/_helpers.ts'

import { FireMode } from '../../config.ts'
import type { MatterManager } from './MatterManager.ts'

export class MatterTank {
  private _matter: number
  matterStart: number

  constructor(
    private manager: MatterManager,
    public matterMax = 5000,
    matter = 0,
    tweenFrom = 0,
  ) {
    this.matterStart = tweenFrom
    this._matter = matter
  }

  private pending = {
    [FireMode.DESTROY]: 0,
    [FireMode.CREATE]: 0,
  }

  private createAvailable() {
    return this._matter - this.getPendingCharge(FireMode.CREATE)
  }

  private destroyAvailable() {
    return this.matterMax - this._matter - this.getPendingCharge(FireMode.DESTROY)
  }

  set(value: number) {
    this._matter = clampMaxInt(value, this.matterMax)
  }

  remove(value: number) {
    this._matter -= clampMaxInt(value, this._matter)
  }

  add(value: number) {
    this._matter += clampMaxInt(value, this.availableSpace())
  }

  getPendingCharge(mode: FireMode) {
    return this.pending[mode]
  }

  getPendingChargePercent(mode: FireMode) {
    return this.getPendingCharge(mode) / this.matterMax
  }

  getChargeAvailablePercent(mode: FireMode) {
    return this.chargeAvailable(mode) / this.matterMax
  }

  setPendingCharge(mode: FireMode, value: number) {
    this.pending[mode] = clampMaxInt(value, this.chargeAvailable(mode))
  }

  addPendingCharge(mode: FireMode, value: number) {
    const available = this.chargeAvailable(mode)
    if (available < value) {
      throw new Error(`[${FireMode[mode]}] pending: attempting to add ${value} when there is only ${available} can be added`)
    }

    this.pending[mode] += value
  }

  removePendingCharge(mode: FireMode, value: number) {
    const existing = this.getPendingCharge(mode)
    if (existing < value) {
      throw new Error(`[${FireMode[mode]}] pending: attempting to remove ${value} when only ${existing} exists`)
    }
    this.pending[mode] -= value
  }

  applyPendingCharge(mode: FireMode, value: number) {
    this.removePendingCharge(mode, value)

    if (mode === FireMode.DESTROY) {
      this.add(value)
      return
    }

    // if (mode === FireMode.CREATE) {
    return this.remove(value)
    // }
  }

  hasChargeAvailable(charge: number, mode: FireMode) {
    return this.chargeAvailable(mode) >= charge
  }

  chargeAvailable(mode: FireMode) {
    if (mode === FireMode.DESTROY) {
      return this.destroyAvailable()
    }

    // if (mode === FireMode.CREATE) {
    return this.createAvailable()
    // }
  }

  percent() {
    return this._matter / this.matterMax
  }

  matterContained() {
    return this._matter
  }

  availableSpace() {
    return this.matterMax - this._matter
  }

  full() {
    return this.matterMax === this._matter
  }

  empty() {
    return this._matter === 0
  }

  destroy() {
    this.manager.remove(this)

    // @ts-expect-error: destroy
    this.manager = null
  }
}