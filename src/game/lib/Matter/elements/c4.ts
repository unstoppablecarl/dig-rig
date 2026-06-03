import { random } from '../../../helpers/random'
import { FIRE, MatterType } from '../_Matter-types.ts'
import { MatterWorkerOutMsg } from '../_MatterWorker-types.ts'
import { ParticleType } from '../../Particles/_particle-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.C4,
  name: 'C4',
  passive: true,
  action(world, tx, ty, idx, next): void {
    if (random() < 60 && world.bordering(tx, ty, idx, FIRE) !== -1) {
      world.doBorderBurn(tx, ty, idx, next)
      postMessage({ type: MatterWorkerOutMsg.SPAWN_PARTICLE, particleType: ParticleType.C4_EXPLOSION, x: tx, y: ty })
    }
  },
}

export default def
