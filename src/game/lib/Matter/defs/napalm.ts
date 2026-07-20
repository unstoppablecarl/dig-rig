import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { FIRE, getFirstOwnerId, type MatterDef, NAPALM, setOwner, setSettled } from '../_Matter.types.ts'

export const NAPALM_DEF = {
  id: NAPALM,
  name: 'Napalm',
  liquid: true as const,
  hasOwnerId: true as const,
  settles: true as const,
  action(sim, tx, ty, idx): void {
    if (random() < 25) {
      const nidx = sim.bordering(tx, ty, idx, FIRE)
      if (nidx !== -1) {
        const tiles = sim.tiles

        // napalm owner or fallback to fire owner
        const ownerId = getFirstOwnerId(tiles[idx], tiles[nidx])

        sim.queueMatterCredit(tx, ty, ownerId)
        sim.consumeLiquidFill(idx)
        tiles[idx] = setOwner(FIRE, ownerId)
        sim.markRenderDirty(tx, ty)
        sim.next.add(idx)
        sim.spawnParticle(ParticleType.NAPALM_EXPLOSION, tx, ty, ownerId)
        return
      }
    }

    const moved = sim.tryFillFlow(tx, ty, idx)
    if (moved) {
      sim.reactivateAround(tx, ty)
      return
    }

    sim.tiles[idx] = setSettled(NAPALM, true)
    sim.markRenderDirty(tx, ty)

    // Keep re-checking only while this cell's run has an actual reachable
    // drain — see water.ts for why.
    if (sim.hasReachableDrainFromCell(tx, ty, NAPALM)) {
      sim.next.add(idx)
    }
  },
} satisfies MatterDef

export default NAPALM_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [NAPALM]: typeof NAPALM_DEF;
  }
}

