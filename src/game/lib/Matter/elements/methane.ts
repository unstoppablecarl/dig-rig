import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { FIRE, METHANE } from '../_Matter-types.ts'
import { MatterCoordinatorOutMsg } from '../MatterSim.types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: METHANE,
  name: 'Methane',
  action(world, tx, ty, idx, next): void {
    // Explode near fire
    if (random() < 25 && world.bordering(tx, ty, idx, FIRE) !== -1) {
      world.doBorderBurn(tx, ty, idx, next)
      postMessage({
        type: MatterCoordinatorOutMsg.SPAWN_PARTICLE,
        particleType: ParticleType.METHANE_EXPLOSION,
        x: tx,
        y: ty,
      })
      return
    }

    // Rise as a gas
    if (random() < 25) {
      if (world.tryRise(idx, tx, ty, next)) return
    }

    // Spread sideways
    const leftFirst = world.leftFirst
    if (
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1, next)
    ) return

    next.add(idx)
  },
}

export default def
