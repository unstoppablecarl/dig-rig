import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { FIRE, getFirstOwnerId, type MatterDef } from '../_Matter-types.ts'
import { MatterCoordinatorOutMsg } from '../MatterSim.types.ts'

export const METHANE_DEF: MatterDef = {
  name: 'Methane',
  action(world, tx, ty, idx): void {
    // Explode near fire
    if (random() < 25) {
      const tiles = world.tiles
      const nidx = world.bordering(tx, ty, idx, FIRE)
      if (nidx !== -1) {

        // methane owner or fallback to fire owner
        const ownerId = getFirstOwnerId(tiles[idx], tiles[nidx])

        world.doBorderBurn(tx, ty, idx, ownerId)
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
      if (world.tryRise(idx, tx, ty)) return
    }

    // Spread sideways
    const leftFirst = world.leftFirst
    if (
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1)
    ) return

    world.next.add(idx)
  },
}
