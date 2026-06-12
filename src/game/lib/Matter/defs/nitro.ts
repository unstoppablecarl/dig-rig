import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { FIRE, getFirstOwnerId, type MatterDef } from '../_Matter.types.ts'
import { MatterCoordinatorOutMsg } from '../MatterSim.types.ts'

export const NITRO_DEF: MatterDef = {
  name: 'Nitro',
  liquid: true,
  action(world, tx, ty, idx): void {
    if (random() < 30) {
      const nidx = world.bordering(tx, ty, idx, FIRE)
      if (nidx !== -1) {
        const tiles = world.tiles

        // nitro owner or fallback to fire owner
        const ownerId = getFirstOwnerId(tiles[idx], tiles[nidx])
        world.doBorderBurn(tx, ty, idx, ownerId)

        postMessage({
          type: MatterCoordinatorOutMsg.SPAWN_PARTICLE,
          particleType: ParticleType.NITRO_EXPLOSION,
          x: tx,
          y: ty,
          ownerId,
        })
        return
      }
    }

    world.doPowderFall(tx, ty, idx)
  },
}
