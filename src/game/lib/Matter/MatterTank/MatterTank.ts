import { clampMaxInt } from '../../../helpers/_helpers.ts'
import type { Position } from '../../../types.ts'
import { FireMode, type MatterTankFireMode } from '../../Player/_FireMode-types'
import type { MatterTankId, MatterTankSource } from './_MatterTank.types.ts'
import type { MatterManager } from './MatterManager.ts'

export class MatterTank {
  private _matter: number
  matterStart: number
  overflowTank: MatterTank | null = null

  constructor(
    private manager: MatterManager,
    private source: MatterTankSource,
    readonly id: MatterTankId,
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

  // Debug only — bypasses conservation. Use applyPendingCharge for gameplay transfers.
  set(value: number) {
    this._matter = clampMaxInt(value, this.matterMax)
  }

  forceAdd(value: number) {
    const space = this.matterMax - this._matter
    if (value <= space) {
      this.add(value)
    } else {
      if (space > 0) this.add(space)
      if (this.overflowTank) {
        const transferAmount = value - space
        this.overflowTank.forceAdd(transferAmount)
        this.manager.scene.vfxParticleManager.spawnMatterTankTransfer(transferAmount, this.source, this.overflowTank.source)
      }
    }
  }

  // Private — only applyPendingCharge may call these.
  // The pending invariants guarantee these never overflow/underflow;
  // if they do, it is a conservation bug
  private add(value: number) {
    if (this._matter + value > this.matterMax) {
      throw new Error(`MatterTank overflow: add(${value}) with _matter=${this._matter}, max=${this.matterMax}`)
    }
    this._matter += value
  }

  private remove(value: number) {
    if (this._matter < value) {
      throw new Error(`MatterTank underflow: remove(${value}) with _matter=${this._matter}`)
    }
    this._matter -= value
  }

  getPendingCharge(mode: MatterTankFireMode) {
    return this.pending[mode]
  }

  getPendingChargePercent(mode: MatterTankFireMode) {
    return this.getPendingCharge(mode) / this.matterMax
  }

  getChargeAvailablePercent(mode: MatterTankFireMode) {
    return this.chargeAvailable(mode) / this.matterMax
  }

  setPendingCharge(mode: MatterTankFireMode, value: number) {
    this.pending[mode] = clampMaxInt(value, this.chargeAvailable(mode))
  }

  addPendingCharge(mode: MatterTankFireMode, value: number) {
    const available = this.chargeAvailable(mode)
    if (available < value) {
      throw new Error(`[${FireMode[mode]}] pending: attempting to add ${value} when there is only ${available} can be added`)
    }

    this.pending[mode] += value
  }

  removePendingCharge(mode: MatterTankFireMode, value: number) {
    const existing = this.getPendingCharge(mode)
    if (existing < value) {
      throw new Error(`[${FireMode[mode]}] pending: attempting to remove ${value} when only ${existing} exists`)
    }
    this.pending[mode] -= value
  }

  applyPendingCharge(mode: MatterTankFireMode, value: number) {
    this.removePendingCharge(mode, value)

    if (mode === FireMode.DESTROY) {
      this.forceAdd(value)
      return
    }

    if (mode === FireMode.CREATE) {
      return this.remove(value)
    }
  }

  hasChargeAvailable(charge: number, mode: MatterTankFireMode) {
    return this.chargeAvailable(mode) >= charge
  }

  clampToChargeAvailable(charge: number, mode: MatterTankFireMode) {
    const available = this.chargeAvailable(mode)
    return Math.min(charge, available)
  }

  chargeAvailable(mode: MatterTankFireMode) {
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

  private _emitPos = { x: 0, y: 0 }

  getEmitPos(): Position {
    if ('matterParticleEmitPosition' in this.source) {
      return this.source.matterParticleEmitPosition(this._emitPos)
    }
    return this.source
  }

  getCollectPos(): Position {
    if ('matterParticleCollectPosition' in this.source) {
      return this.source.matterParticleCollectPosition()
    }
    return this.source
  }

  destroy() {
    this.manager?.remove(this)

    // @ts-expect-error: destroy
    this.manager = null
  }
}