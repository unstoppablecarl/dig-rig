import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { FIRE, getFirstOwnerId, type MatterDef, C4 } from '../_Matter.types.ts'
import { MatterCoordinatorOutMsg } from '../MatterSim.types.ts'

export const C4_DEF = {
  id: C4,
  name: 'C4',
  passive: true,
  action(world, tx, ty, idx): void {
    if (random() < 60) {
      const tiles = world.tiles
      const nidx = world.bordering(tx, ty, idx, FIRE)
      if (nidx !== -1) {

        // c4 owner or fallback to fire owner
        const ownerId = getFirstOwnerId(tiles[idx], tiles[nidx])

        world.doBorderBurn(tx, ty, idx, ownerId)
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
