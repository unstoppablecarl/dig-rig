/// <reference lib="webworker" />
import { FireMode, type MatterTankFireMode } from '../../../Player/_FireMode-types.ts'
import type { MatterTankId } from '../../../Matter/Tank/_MatterTank.types.ts'
import type { MatterTankManagerData } from '../../data/MatterTankManagerData.ts'
import { SimMatterTank } from './SimMatterTank.ts'

export class SimMatterTanks {
  private readonly tanks = new Map<number, SimMatterTank>()
  private readonly credits = new Map<MatterTankId, number>()

  constructor(
    private readonly matterManagerData: MatterTankManagerData,
  ) {
  }

  getTank(id: MatterTankId): SimMatterTank | null {
    let tank = this.tanks.get(id)
    if (!tank) {
      tank = new SimMatterTank(this.matterManagerData, id)
      this.tanks.set(id, tank)
    }
    return tank
  }

  clearPending() {
    this.matterManagerData.pendingCreate.fill(0)
    this.matterManagerData.pendingDestroy.fill(0)
  }

  addPendingCharge(ownerId: MatterTankId, mode: MatterTankFireMode, value: number) {
    if (mode === FireMode.CREATE) {
      this.matterManagerData.pendingCreate[ownerId] += value
    } else {
      this.matterManagerData.pendingDestroy[ownerId] += value
    }
  }

  addCredit(tankId: MatterTankId, count: number) {
    this.credits.set(tankId, (this.credits.get(tankId) ?? 0) + count)
  }

  _flushCredit: number[] = []

  flushCredit() {
    this._flushCredit.length = 0
    for (const [tankId, count] of this.credits) {
      this.getTank(tankId)?.add(count, this._flushCredit)
    }
    this.credits.clear()
    return this._flushCredit
  }
}