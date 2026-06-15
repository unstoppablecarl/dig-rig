import { random } from '../../../helpers/random'
import { FIRE, getFirstOwnerId, type MatterDef, OIL, setSettled } from '../_Matter.types.ts'

export const OIL_DEF = {
  id: OIL,
  name: 'Oil',
  liquid: true as const,
  hasOwnerId: true as const,
  action(sim, tx, ty, idx): void {
    if (random() < 30) {
      const nidx = sim.bordering(tx, ty, idx, FIRE)
      if (nidx !== -1) {
        const tiles = sim.tiles

        // oil owner or fallback to fire owner
        const ownerId = getFirstOwnerId(tiles[idx], tiles[nidx])
        sim.doBorderBurn(tx, ty, idx, ownerId)
      }
    }

    const moved = sim.tryLiquidFlow(tx, ty, idx)
    if (!moved) {
      sim.tiles[idx] = setSettled(OIL, true)
      sim.markDirty(tx, ty)
    }
  },
} satisfies MatterDef

export default OIL_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [OIL]: typeof OIL_DEF;
  }
}
