import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { C4, FIRE, getFirstOwnerId, type MatterDef, SupportType } from '../_Matter.types.ts'
import { MatterCoordinatorOutMsg } from '../MatterSim.types.ts'

export const C4_DEF = {
  id: C4,
  name: 'C4',
  immutableSupport: SupportType.AFFIXED as const,
  hasOwnerId: true as const,
  action(sim, tx, ty, idx): void {
    if (random() < 60) {
      const tiles = sim.tiles
      const nidx = sim.bordering(tx, ty, idx, FIRE)
      if (nidx !== -1) {

        // c4 owner or fallback to fire owner
        const ownerId = getFirstOwnerId(tiles[idx], tiles[nidx])

        sim.doBorderBurn(tx, ty, idx, ownerId)
        postMessage({
          type: MatterCoordinatorOutMsg.SPAWN_PARTICLE,
          particleType: ParticleType.C4_EXPLOSION,
          x: tx,
          y: ty,
          ownerId,
        })
      }
    }
  },
} satisfies MatterDef

export default C4_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [C4]: typeof C4_DEF;
  }
}
