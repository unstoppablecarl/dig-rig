import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { FIRE, getFirstOwnerId, type MatterDef, NAPALM, setOwner, setSettled } from '../_Matter.types.ts'
import { MatterCoordinatorOutMsg } from '../MatterSim.types.ts'

export const NAPALM_DEF = {
  id: NAPALM,
  name: 'Napalm',
  liquid: true as const,
  hasOwnerId: true as const,
  action(sim, tx, ty, idx): void {
    if (random() < 25) {
      const nidx = sim.bordering(tx, ty, idx, FIRE)
      if (nidx !== -1) {
        const tiles = sim.tiles

        // napalm owner or fallback to fire owner
        const ownerId = getFirstOwnerId(tiles[idx], tiles[nidx])

        tiles[idx] = setOwner(FIRE, ownerId)
        sim.markDirty(tx, ty)
        sim.next.add(idx)
        postMessage({
          type: MatterCoordinatorOutMsg.SPAWN_PARTICLE,
          particleType: ParticleType.NAPALM_EXPLOSION,
          x: tx,
          y: ty,
          ownerId,
        })
        return
      }
    }

    const moved = sim.tryLiquidFlow(tx, ty, idx)
    if (!moved) {
      sim.tiles[idx] = setSettled(NAPALM, true)
      sim.markDirty(tx, ty)
    }
  },
} satisfies MatterDef

export default NAPALM_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [NAPALM]: typeof NAPALM_DEF;
  }
}

