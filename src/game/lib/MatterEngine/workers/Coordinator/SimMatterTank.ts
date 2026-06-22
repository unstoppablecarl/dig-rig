/// <reference lib="webworker" />
import { clampMaxInt } from '../../../../helpers/_helpers.ts'
import { FireMode, type MatterTankFireMode } from '../../../Player/_FireMode-types.ts'
import type { MatterTankId } from '../../../Matter/Tank/_MatterTank.types.ts'
import type { MatterTankManagerData } from '../../data/MatterTankManagerData.ts'

export class SimMatterTank {

  constructor(
    private readonly data: MatterTankManagerData,
    readonly id: MatterTankId,
  ) {
  }

  get matterMax(): number {
    return this.data.getMatterMax(this.id)
  }

  get matter() {
    return this.data.getMatter(this.id)
  }

  private _pendingOf(mode: MatterTankFireMode): number {
    return mode === FireMode.CREATE
      ? this.data.getPendingCreate(this.id)
      : this.data.getPendingDestroy(this.id)
  }

  private _setPending(mode: MatterTankFireMode, value: number) {
    if (mode === FireMode.CREATE) {
      this.data.setPendingCreate(this.id, value)
    } else {
      this.data.setPendingDestroy(this.id, value)
    }
  }

  private _createAvailable() {
    return this.matter - this._pendingOf(FireMode.CREATE)
  }

  private _destroyAvailable() {
    return this.matterMax - this.matter - this._pendingOf(FireMode.DESTROY)
  }

  add(value: number, overflowOut?: number[]) {
    let remaining = value
    let prevId = -1
    let id = this.id
    const visited = new Set<number>()
    while (remaining > 0) {
      if (visited.has(id)) {
        console.error(`SimMatterTank.add: overflow chain cycle detected at tank ${id}, dropping ${remaining} matter`)
        break
      }
      visited.add(id)
      const max = this.data.matterMax[id]
      if (max === 0) {
        console.error(`SimMatterTank.add: tank ${id} has matterMax=0 (was Infinity stored as Uint32?), dropping ${remaining} matter`)
        break
      }
      const current = this.data.matter[id]
      const space = max - current
      if (space > 0) {
        const gain = Math.min(remaining, space)
        this.data.matter[id] = current + gain
        if (prevId !== -1 && overflowOut) overflowOut.push(prevId, id, gain)
        remaining -= gain
      }
      if (remaining === 0) break
      prevId = id
      const nextId = this.data.getOverflow(id) as MatterTankId
      if (nextId === 0) break
      id = nextId
    }
    if (remaining > 0) {
      console.error(`SimMatterTank overflow: forceAdd(${value}) with ${remaining} remaining unfit`)
    }
  }

  remove(value: number) {
    const current = this.matter
    if (current < value) {
      throw new Error(`SimMatterTank underflow: remove(${value}) with matter=${current}`)
    }
    this.data.setMatter(this.id, current - value)
  }

  getPendingCharge(mode: MatterTankFireMode): number {
    return this._pendingOf(mode)
  }

  getPendingChargePercent(mode: MatterTankFireMode): number {
    return this._pendingOf(mode) / this.matterMax
  }

  getChargeAvailablePercent(mode: MatterTankFireMode): number {
    return this.chargeAvailable(mode) / this.matterMax
  }

  setPendingCharge(mode: MatterTankFireMode, value: number) {
    this._setPending(mode, clampMaxInt(value, this.chargeAvailable(mode)))
  }

  addPendingCharge(mode: MatterTankFireMode, value: number) {
    const available = this.chargeAvailable(mode)
    if (available < value) {
      throw new Error(`[${FireMode[mode]}] pending: attempting to add ${value} when only ${available} available`)
    }
    this._setPending(mode, this._pendingOf(mode) + value)
  }

  removePendingCharge(mode: MatterTankFireMode, value: number) {
    const existing = this._pendingOf(mode)
    if (existing < value) {
      throw new Error(`[${FireMode[mode]}] pending: attempting to remove ${value} when only ${existing} exists`)
    }
    this._setPending(mode, existing - value)
  }

  applyPendingCharge(mode: MatterTankFireMode, value: number, overflowOut?: number[]) {
    this.removePendingCharge(mode, value)
    if (mode === FireMode.DESTROY) {
      this.add(value, overflowOut)
    } else {
      this.remove(value)
    }
  }

  chargeAvailable(mode: MatterTankFireMode): number {
    return mode === FireMode.DESTROY ? this._destroyAvailable() : this._createAvailable()
  }

  hasChargeAvailable(charge: number, mode: MatterTankFireMode): boolean {
    return this.chargeAvailable(mode) >= charge
  }

  clampToChargeAvailable(charge: number, mode: MatterTankFireMode): number {
    return Math.max(0, Math.min(charge, this.chargeAvailable(mode)))
  }

  matterContained(): number {
    return this.matter
  }

  availableSpace(): number {
    return this.matterMax - this.matter
  }

  full(): boolean {
    return this.matter === this.matterMax
  }

  empty(): boolean {
    return this.matter === 0
  }

  percent(): number {
    return this.matter / this.matterMax
  }

  destroy() {
    this.data.setMatter(this.id, 0)
    this.data.setPendingCreate(this.id, 0)
    this.data.setPendingDestroy(this.id, 0)
  }
}
