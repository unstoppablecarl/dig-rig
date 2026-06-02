import { random } from '../../../helpers/random'
import { FIRE, MatterType, NAPALM, SETTLED_FLAG } from '../_Matter-types.ts'
import { MatterWorkerOutMsg } from '../_MatterWorker-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.NAPALM,
  name: 'Napalm',
  action(world, tx, ty, idx, next): void {
    if (random() < 25 && world.bordering(tx, ty, idx, FIRE) !== -1) {
      world.tiles[idx] = FIRE
      world.markDirty(tx, ty)
      next.add(idx)
      postMessage({ type: MatterWorkerOutMsg.SPAWN_PARTICLE, particleType: 'napalm_explosion', x: tx, y: ty })
      return
    }

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx,                         ty + 1, NAPALM, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 :  1), ty + 1, NAPALM, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ?  1 : -1), ty + 1, NAPALM, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 :  1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ?  1 : -1, next)

    if (!moved) {
      world.tiles[idx] = NAPALM | SETTLED_FLAG
      world.markDirty(tx, ty)
    }
  },
}

export default def
