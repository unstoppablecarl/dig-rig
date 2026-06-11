import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { FIRE, getFirstOwnerId, type MatterDef, NAPALM, setOwner, setSettled } from '../_Matter-types.ts'
import { MatterCoordinatorOutMsg } from '../MatterSim.types.ts'

export const NAPALM_DEF: MatterDef = {
  name: 'Napalm',
  action(world, tx, ty, idx): void {
    if (random() < 25) {
      const nidx = world.bordering(tx, ty, idx, FIRE)
      if (nidx !== -1) {
        const tiles = world.tiles

        // napalm owner or fallback to fire owner
        const ownerId = getFirstOwnerId(tiles[idx], tiles[nidx])

        tiles[idx] = setOwner(FIRE, ownerId)
        world.markDirty(tx, ty)
        world.next.add(idx)
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

    const moved = world.tryLiquidFlow(tx, ty, idx)
    if (!moved) {
      world.tiles[idx] = setSettled(NAPALM, true)
      world.markDirty(tx, ty)
    }
  },
}
