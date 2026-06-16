import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { FIRE, getFirstOwnerId, type MatterDef, METHANE } from '../_Matter.types.ts'
import { MatterCoordinatorOutMsg } from '../MatterSim.types.ts'

export const METHANE_DEF = {
  id: METHANE,
  name: 'Methane',
  hasOwnerId: true as const,
  alwaysActive: true as const,
  action(sim, tx, ty, idx): void {
    // Explode near fire
    if (random() < 25) {
      const tiles = sim.tiles
      const nidx = sim.bordering(tx, ty, idx, FIRE)
      if (nidx !== -1) {

        // methane owner or fallback to fire owner
        const ownerId = getFirstOwnerId(tiles[idx], tiles[nidx])

        sim.doBorderBurn(tx, ty, idx, ownerId)
        postMessage({
          type: MatterCoordinatorOutMsg.SPAWN_PARTICLE,
          particleType: ParticleType.METHANE_EXPLOSION,
          x: tx,
          y: ty,
        })
        return
      }
    }

    // Rise as a gas
    if (random() < 25) {
      if (sim.tryRise(idx, tx, ty)) return
    }

    // Spread sideways
    const leftFirst = sim.leftFirst
    if (
      sim.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1) ||
      sim.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1)
    ) return

    sim.next.add(idx)
  },
} satisfies MatterDef

export default METHANE_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [METHANE]: typeof METHANE_DEF;
  }
}

