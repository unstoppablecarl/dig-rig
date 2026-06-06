import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { FIRE } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'
import { MatterCoordinatorOutMsg } from '../MatterSim.types.ts'

export const C4_DEF: ElementDef = {
  name: 'C4',
  passive: true,
  action(world, tx, ty, idx, next): void {
    if (random() < 60 && world.bordering(tx, ty, idx, FIRE) !== -1) {
      world.doBorderBurn(tx, ty, idx, next)
      postMessage({
        type: MatterCoordinatorOutMsg.SPAWN_PARTICLE,
        particleType: ParticleType.C4_EXPLOSION,
        x: tx,
        y: ty,
      })
    }
  },
}
