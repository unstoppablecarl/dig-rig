import { random } from '../../../helpers/random'
import { FIRE, MatterType, OIL, SETTLED_FLAG } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.OIL,
  name: 'Oil',
  liquid: true,
  action(world, tx, ty, idx, next): void {
    // Catch fire
    if (random() < 30 && world.bordering(tx, ty, idx, FIRE) !== -1) {
      world.doBorderBurn(tx, ty, idx, next)
      return
    }

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx,                         ty + 1, OIL, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 :  1), ty + 1, OIL, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ?  1 : -1), ty + 1, OIL, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 :  1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ?  1 : -1, next)

    if (!moved) {
      world.tiles[idx] = OIL | SETTLED_FLAG
      world.markDirty(tx, ty)
    }
  },
}

export default def
