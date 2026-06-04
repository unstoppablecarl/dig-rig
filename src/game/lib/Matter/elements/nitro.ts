import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { FIRE, NITRO, setSettled } from '../_Matter-types.ts'
import { MatterCoordinatorOutMsg } from '../MatterSim.types.ts'
import type { ElementDef } from '../elements.ts'

export const NITRO_DEF: ElementDef = {
  name: 'Nitro',
  liquid: true,
  action(world, tx, ty, idx, next): void {
    if (random() < 30 && world.borderingAdjacent(tx, ty, idx, FIRE) !== -1) {
      world.doBorderBurn(tx, ty, idx, next)
      postMessage({ type: MatterCoordinatorOutMsg.SPAWN_PARTICLE, particleType: ParticleType.NITRO_EXPLOSION, x: tx, y: ty })
      return
    }

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx, ty + 1, NITRO, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, NITRO, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, NITRO, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1, next)

    if (!moved) {
      world.tiles[idx] = setSettled(NITRO, true)
      world.markDirty(tx, ty)
    }
  },
}
