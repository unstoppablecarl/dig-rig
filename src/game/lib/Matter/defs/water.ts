import { CRYO, LAVA, type MatterDef, matterType, OIL, SALT, SAND, setSettled, WATER } from '../_Matter.types.ts'
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

    const moved = sim.tryFillFlow(tx, ty, idx)
    if (moved) return

    // Water is denser than oil — sink through it
    if (sim.doDensityLiquid(tx, ty, idx, OIL, 25, 50)) return
    // Probability roll may have missed — stay active so we retry next frame
    if (sim.hasDensityBelow(tx, ty, OIL)) {
      sim.next.add(idx)
      return
    }

    sim.tiles[idx] = WATER_SETTLED
    sim.markDirty(tx, ty)

    // Wake settled SAND directly above — it should sink through water
    if (ty > 0) {
      const aboveIdx = (ty - 1) * sim.width + tx
      const raw = sim.tiles[aboveIdx]
      if (matterType(raw) === SAND) {
        // un settle sand
        sim.tiles[aboveIdx] = SAND
        sim.markDirty(tx, ty - 1)
        sim.next.add(aboveIdx)
      }
    }
  },
} satisfies MatterDef

export default WATER_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [WATER]: typeof WATER_DEF;
  }
}

