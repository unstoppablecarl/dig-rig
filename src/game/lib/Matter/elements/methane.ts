import { FIRE, MatterType } from '../_Matter-types.ts'
import { rng } from '../MatterWorld.ts'
import { MatterWorkerOutMsg } from '../_MatterWorker-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.METHANE,
  name: 'Methane',
  action(world, tx, ty, idx, next): void {
    // Explode near fire
    if (rng() < 25 && world.bordering(tx, ty, idx, FIRE) !== -1) {
      world.doBorderBurn(tx, ty, idx, next)
      postMessage({ type: MatterWorkerOutMsg.SPAWN_PARTICLE, particleType: 'methane_explosion', x: tx, y: ty })
      return
    }

    // Rise as a gas
    if (rng() < 25) {
      if (world.tryRise(idx, tx, ty, next)) return
    }

    // Spread sideways
    const leftFirst = world.leftFirst
    if (
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 :  1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ?  1 : -1, next)
    ) return

    next.add(idx)
  },
}

export default def
