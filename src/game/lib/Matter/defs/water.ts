import { CRYO, isSettled, LAVA, type MatterDef, matterType, OIL, SALT, SAND, setSettled, WATER } from '../_Matter.types.ts'
import { MatterTypeSet } from '../data/MatterTypeSet.ts'

export const WATER_SETTLED = setSettled(WATER, true)
const WAKE_SETTLED = new MatterTypeSet(LAVA, SALT, CRYO)

export const WATER_DEF = {
  id: WATER,
  name: 'Water',
  lavaImmune: true as const,
  acidImmune: true as const,
  liquid: true as const,
  settles: true as const,
  action(sim, tx, ty, idx): void {

    sim.wakeSettledNeighborTypes(tx, ty, idx, WAKE_SETTLED)

    // Water is denser than oil — sink through it
    if (sim.doDensityLiquid(tx, ty, idx, OIL, 25, 50)) return
    // Probability roll may have missed — stay active so we retry next frame
    if (sim.hasDensityBelow(tx, ty, OIL)) {
      sim.next.add(idx)
      return
    }

    const moved = sim.tryFillFlow(tx, ty, idx)
    if (moved) {
      sim.reactivateAround(tx, ty)
      return
    }

    sim.tiles[idx] = WATER_SETTLED
    sim.markRenderDirty(tx, ty)

    // Wake settled SAND directly above — it should sink through water
    if (ty > 0) {
      const aboveIdx = (ty - 1) * sim.width + tx
      const raw = sim.tiles[aboveIdx]
      if (matterType(raw) === SAND && isSettled(raw)) {
        // un settle sand
        sim.tiles[aboveIdx] = SAND
        sim.markDirty(tx, ty - 1)
        sim.next.add(aboveIdx)
      }
    }

    // Keep re-checking only while this cell's run has an actual reachable
    // drain — otherwise a settled tile only wakes via a neighbor's
    // reactivateAround, and a row that drops out of drainWatchRows tracking
    // (no confirmed drain left) never calls that. Scoped to a real drain
    // (not "touches any wall") so a genuinely sealed/flat pool can still go
    // idle instead of every boundary tile re-queuing forever.
    if (sim.hasReachableDrainFromCell(tx, ty, WATER)) {
      sim.next.add(idx)
    }
  },
} satisfies MatterDef

export default WATER_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [WATER]: typeof WATER_DEF;
  }
}

