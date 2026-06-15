import { LAVA, type MatterDef, matterType, OIL, SALT, SAND, setSettled, WATER } from '../_Matter.types.ts'

export const WATER_SETTLED = setSettled(WATER, true)

export const WATER_DEF = {
  id: WATER,
  name: 'Water',
  lavaImmune: true,
  acidImmune: true,
  liquid: true,
  action(sim, tx, ty, idx): void {
    sim.wakeSettledNeighbors(tx, ty, idx, LAVA)
    sim.wakeSettledNeighbors(tx, ty, idx, SALT)

    const moved = sim.tryLiquidFlow(tx, ty, idx)
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

