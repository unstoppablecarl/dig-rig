import type { Position } from '../../../types.ts'
import type { MatterTankManagerData } from '../../MatterEngine/data/MatterTankManagerData.ts'
import { FireMode, type MatterTankFireMode } from '../../Player/_FireMode-types'
import type { MatterType } from '../_Matter.types.ts'
import { getReserveDestroyAmount } from '../matter.ts'
import { type MatterTankId, type MatterTankSource, NO_MATTER_TANK_ID } from './_MatterTank.types.ts'
import type { MatterManager } from './MatterManager.ts'

export class MatterTank {
  matterStart: number
  private _overflowTank: MatterTank | null = null

  get overflowTank(): MatterTank | null {
    return this._overflowTank
  }

  set overflowTank(tank: MatterTank | null) {
    this._overflowTank = tank
    this.data.setOverflow(this.id, tank?.id ?? NO_MATTER_TANK_ID)
  }

  constructor(
    private manager: MatterManager,
    private readonly data: MatterTankManagerData,
    readonly source: MatterTankSource,
    readonly id: MatterTankId,
    tweenFrom = 0,
  ) {
    this.matterStart = tweenFrom
  }

  get matterMax() {
    return this.data.getMatterMax(this.id)
  }

  private createAvailable() {
    return this.matterContained() - this.data.getPendingCreate(this.id)
  }

  private destroyAvailable() {
    return this.matterMax - this.matterContained() - this.data.getPendingDestroy(this.id) - this.reservedDestroy
  }

  // Combines the placed reservation (already-painted lava/acid tiles) with the in-flight
  // reservation (a create-lava/acid beam's not-yet-painted budget) — from the player's
  // perspective this is one reservation, held from the instant the beam is fired.
  get reservedDestroy(): number {
    return this.data.getReservedDestroyPlaced(this.id) + this.data.getReservedDestroyInFlight(this.id)
  }

  getReservedDestroyPercent(): number {
    return this.reservedDestroy / this.matterMax
  }

  getPendingCharge(mode: MatterTankFireMode): number {
    return mode === FireMode.CREATE
      ? this.data.getPendingCreate(this.id)
      : this.data.getPendingDestroy(this.id)
  }

  getPendingChargePercent(mode: MatterTankFireMode) {
    return this.getPendingCharge(mode) / this.matterMax
  }

  getChargeAvailablePercent(mode: MatterTankFireMode) {
    return this.chargeAvailable(mode) / this.matterMax
  }

  hasChargeAvailable(charge: number, mode: MatterTankFireMode, createType?: MatterType) {
    return this.chargeAvailable(mode, createType) >= charge
  }

  clampToChargeAvailable(charge: number, mode: MatterTankFireMode, createType?: MatterType) {
    // chargeAvailable might be negative but that is valid.
    // it shouldn't keep going negative here though
    return Math.max(0, Math.min(charge, this.chargeAvailable(mode, createType)))
  }

  // createType — when creating a type that reserves destroy-charge (lava, acid), the number of
  // tiles creatable is also capped by how many reservations the tank's destroy headroom can hold.
  chargeAvailable(mode: MatterTankFireMode, createType?: MatterType) {
    if (mode === FireMode.DESTROY) {
      return this.destroyAvailable()
    }

    // if (mode === FireMode.CREATE) {
    const available = this.createAvailable()
    if (createType === undefined) return available

    const reserveAmount = getReserveDestroyAmount(createType)
    if (reserveAmount === 0) return available

    return Math.min(available, Math.floor(this.destroyAvailable() / reserveAmount))
    // }
  }

  percent() {
    return this.matterContained() / this.matterMax
  }

  matterContained() {
    return this.data.getMatter(this.id)
  }

  availableSpace() {
    return this.matterMax - this.matterContained()
  }

  full() {
    return this.matterMax === this.matterContained()
  }

  empty() {
    return this.matterContained() === 0
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
    this.data.setMatter(this.id, 0)
    this.manager?.remove(this)

    // @ts-expect-error: destroy
    this.manager = null
  }
}
