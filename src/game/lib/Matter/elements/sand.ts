import { ACID, OIL, SALT_WATER, SAND, SAND_SETTLED, WATER } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'
import type { MatterWorker } from '../MatterWorker.ts'

const def: ElementDef = {
  id: SAND,
  name: 'Sand',
  sinksThrough: [WATER, OIL, SALT_WATER, ACID],
  action(world: MatterWorker, tx, ty, idx, next): void {
    const leftFirst = world.leftFirst

    const moved =
      world.tryMove(idx, tx, ty, tx, ty + 1, SAND, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, SAND, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, SAND, next)

    if (!moved) {
      world.tiles[idx] = SAND_SETTLED
      world.markDirty(tx, ty)
      world.justSettled.push(idx)
    }
  },
}

export default def
