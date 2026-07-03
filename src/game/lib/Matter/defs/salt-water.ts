import { LAVA, type MatterDef, OIL, SALT, SALT_WATER, setSettled, WATER } from '../_Matter.types.ts'
import { MatterTypeSet } from '../data/MatterTypeSet.ts'

const WAKE_SETTLED = new MatterTypeSet(LAVA, SALT)

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
    if (moved) return

    // Salt water is denser than fresh water and oil — sink through them
    if (sim.doDensityLiquid(tx, ty, idx, WATER, 25, 25)) return
    if (sim.doDensityLiquid(tx, ty, idx, OIL, 25, 25)) return
    if (sim.hasDensityBelow(tx, ty, WATER) || sim.hasDensityBelow(tx, ty, OIL)) {
      sim.next.add(idx)
      return
    }

    sim.tiles[idx] = setSettled(SALT_WATER, true)
    sim.markDirty(tx, ty)
  },
} satisfies MatterDef

export default SALT_WATER_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [SALT_WATER]: typeof SALT_WATER_DEF;
  }
}