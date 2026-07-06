/// <reference lib="webworker" />
import { ENABLE_MATTER_TANK_MUTATION_TRACKING_DEBUG } from '../../../../config.ts'
import { FILL_MAX } from '../../../Matter/_Liquid.constants.ts'
import { type MatterTankId, NO_MATTER_TANK_ID } from '../../../Matter/Tank/_MatterTank.types.ts'
import { FireMode, type MatterTankFireMode } from '../../../Player/_FireMode-types.ts'
import type { MatterTankManagerData } from '../../data/MatterTankManagerData.ts'
import { type MatterMutationLabel, MatterMutationLog } from './MatterMutationLog.ts'

export class SimMatterTanks {
  private readonly credits = new Map<MatterTankId, number>()
  readonly mutationLog = new MatterMutationLog()
  private frame = 0

  constructor(
    private readonly data: MatterTankManagerData,
  ) {
  }

  setFrame(frame: number) {
    this.frame = frame
  }

  clearPending() {
    this.data.clearAllPending()
  }

  addPendingCharge(ownerId: MatterTankId, mode: MatterTankFireMode, value: number) {
    if (mode === FireMode.CREATE) {
      this.data.addPendingCreate(ownerId, value)
    } else {
      this.data.addPendingDestroy(ownerId, value)
    }
  }

  // Recompute-cleared, like addPendingCharge — the not-yet-painted portion of a create-lava/acid
  // beam's eventual reservation. Self-healing, so unlike reserveDestroyCharge it needs no release.
  addReservedDestroyInFlight(ownerId: MatterTankId, value: number) {
    this.data.addReservedDestroyInFlight(ownerId, value)
  }

  reserveDestroyCharge(ownerId: MatterTankId, amount: number, label: MatterMutationLabel) {
    if (ownerId === NO_MATTER_TANK_ID || amount === 0) return
    this.data.addReservedDestroyPlaced(ownerId, amount)
    if (ENABLE_MATTER_TANK_MUTATION_TRACKING_DEBUG) {
      this.mutationLog.push({
        frame: this.frame, ownerId, kind: 'reserve', amount,
        resultingValue: this.data.getReservedDestroyPlaced(ownerId), label,
      })
    }
  }

  releaseDestroyCharge(ownerId: MatterTankId, amount: number, label: MatterMutationLabel) {
    if (ownerId === NO_MATTER_TANK_ID || amount === 0) return
    const current = this.data.getReservedDestroyPlaced(ownerId)
    if (current < amount) {
      console.error(`SimMatterTanks.releaseDestroyCharge: underflow for tank ${ownerId}, releasing ${amount} but only ${current} reserved (label=${label})`)
      this.data.setReservedDestroyPlaced(ownerId, 0)
    } else {
      this.data.setReservedDestroyPlaced(ownerId, current - amount)
    }
    if (ENABLE_MATTER_TANK_MUTATION_TRACKING_DEBUG) {
      this.mutationLog.push({
        frame: this.frame, ownerId, kind: 'release', amount,
        resultingValue: this.data.getReservedDestroyPlaced(ownerId), label,
      })
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

  getLiquidMatter(id: MatterTankId): number {
    return this.data.getLiquidMatter(id)
  }

  addLiquidMatter(id: MatterTankId, fill: number) {
    this.data.addLiquidMatter(id, fill)
  }

  // Debit fill units from liquidMatter. If liquidMatter is insufficient, converts from solid tank
  // at FILL_MAX:1 rate to cover the shortfall. Returns the solid units consumed (0 if liquid covered it).
  removeLiquidMatter(id: MatterTankId, fill: number): number {
    const available = this.data.getLiquidMatter(id)
    if (available >= fill) {
      this.data.setLiquidMatter(id, available - fill)
      return 0
    }
    const shortfall = fill - available
    this.data.setLiquidMatter(id, 0)
    const solidNeeded = Math.ceil(shortfall / FILL_MAX)
    this.remove(id, solidNeeded)
    const excess = solidNeeded * FILL_MAX - shortfall
    if (excess > 0) {
      this.data.addLiquidMatter(id, excess)
    }
    return solidNeeded
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
      const max = this.data.getMatterMax(id)
      if (max === 0) {
        console.error(`SimMatterTank.add: tank ${id} has matterMax=0 (was Infinity stored as Uint32?), dropping ${remaining} matter`)
        break
      }
      const current = this.data.getMatter(id)
      const space = max - current
      if (space > 0) {
        const gain = Math.min(remaining, space)
        this.data.setMatter(id, current + gain)
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