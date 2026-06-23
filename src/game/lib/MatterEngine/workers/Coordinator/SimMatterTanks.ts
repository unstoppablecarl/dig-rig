/// <reference lib="webworker" />
import type { MatterTankId } from '../../../Matter/Tank/_MatterTank.types.ts'
import { FireMode, type MatterTankFireMode } from '../../../Player/_FireMode-types.ts'
import type { MatterTankManagerData } from '../../data/MatterTankManagerData.ts'

export class SimMatterTanks {
  private readonly credits = new Map<MatterTankId, number>()

  constructor(
    private readonly data: MatterTankManagerData,
  ) {
  }

  clearPending() {
    this.data.pendingCreate.fill(0)
    this.data.pendingDestroy.fill(0)
  }

  addPendingCharge(ownerId: MatterTankId, mode: MatterTankFireMode, value: number) {
    if (mode === FireMode.CREATE) {
      this.data.pendingCreate[ownerId] += value
    } else {
      this.data.pendingDestroy[ownerId] += value
    }
  }

  addCredit(tankId: MatterTankId, count: number) {
    this.credits.set(tankId, (this.credits.get(tankId) ?? 0) + count)
  }

  _flushCredit: number[] = []

  flushCredit() {
    this._flushCredit.length = 0
    for (const [tankId, count] of this.credits) {
      this.add(tankId, count, this._flushCredit)
    }
    this.credits.clear()
    return this._flushCredit
  }

  add(id: MatterTankId, value: number, overflowOut?: number[]) {
    let remaining = value
    let prevId = -1
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

  remove(id: MatterTankId, value: number) {
    const current = this.data.getMatter(id)
    if (current < value) {
      throw new Error(`SimMatterTank underflow: remove(${value}) with matter=${current}`)
    }
    this.data.setMatter(id, current - value)
  }
}