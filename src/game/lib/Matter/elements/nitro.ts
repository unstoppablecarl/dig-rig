import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { FIRE, NITRO, SETTLED_FLAG } from '../_Matter-types.ts'
import { MatterWorkerOutMsg } from '../_MatterWorker-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: NITRO,
  name: 'Nitro',
  liquid: true,
  action(world, tx, ty, idx, next): void {
    if (random() < 30 && world.borderingAdjacent(tx, ty, idx, FIRE) !== -1) {
      world.doBorderBurn(tx, ty, idx, next)
      postMessage({ type: MatterWorkerOutMsg.SPAWN_PARTICLE, particleType: ParticleType.NITRO_EXPLOSION, x: tx, y: ty })
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
      world.tiles[idx] = NITRO | SETTLED_FLAG
      world.markDirty(tx, ty)
    }
  },
}

export default def
