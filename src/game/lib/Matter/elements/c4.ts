import { FIRE, MatterType } from '../_Matter-types.ts'
import { rng } from '../MatterWorld.ts'
import { MatterWorkerOutMsg } from '../_MatterWorker-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.C4,
  name: 'C4',
  passive: true,
  action(world, tx, ty, idx, next): void {
    if (rng() < 60 && world.bordering(tx, ty, idx, FIRE) !== -1) {
      world.doBorderBurn(tx, ty, idx, next)
      postMessage({ type: MatterWorkerOutMsg.SPAWN_PARTICLE, particleType: 'c4_explosion', x: tx, y: ty })
    }
  },
}

export default def
