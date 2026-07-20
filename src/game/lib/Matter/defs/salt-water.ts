import { EMPTY, LAVA, type MatterDef, OIL, SALT, SALT_WATER, setSettled, WATER } from '../_Matter.types.ts'
import { MatterTypeSet } from '../data/MatterTypeSet.ts'

const WAKE_SETTLED = new MatterTypeSet(LAVA, SALT)
const IS_SETTLED = new MatterTypeSet(SALT_WATER, EMPTY)

export const SALT_WATER_DEF = {
  id: SALT_WATER,
  name: 'Salt Water',
  lavaImmune: true as const,
  acidImmune: true as const,
  liquid: true as const,
  settles: true as const,
  action(sim, tx, ty, idx): void {
    sim.wakeSettledNeighborTypes(tx, ty, idx, WAKE_SETTLED)

    const moved = sim.tryFillFlow(tx, ty, idx)
    if (moved) {
      sim.reactivateAround(tx, ty)
      return
    }

    // Salt water is denser than fresh water and oil — sink through them
    if (sim.doDensityLiquid(tx, ty, idx, WATER, 25, 25)) return
    if (sim.doDensityLiquid(tx, ty, idx, OIL, 25, 25)) return
    if (sim.hasDensityBelow(tx, ty, WATER) || sim.hasDensityBelow(tx, ty, OIL)) {
      sim.next.add(idx)
      return
    }

    sim.tiles[idx] = setSettled(SALT_WATER, true)
    sim.markRenderDirty(tx, ty)

    // Keep re-checking until fully boxed in — see water.ts for why.
    if (!sim.surroundedByAny(tx, ty, idx, IS_SETTLED)) {
      sim.next.add(idx)
    }
  },
} satisfies MatterDef

export default SALT_WATER_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [SALT_WATER]: typeof SALT_WATER_DEF;
  }
}