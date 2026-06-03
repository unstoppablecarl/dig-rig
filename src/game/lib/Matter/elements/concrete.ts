import { random } from '../../../helpers/random'
import { CONCRETE, MatterType, SETTLED_FLAG, SOLID } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.CONCRETE,
  name: 'Concrete',
  sinksThrough: [MatterType.WATER, MatterType.SALT_WATER],
  action(world, tx, ty, idx, next): void {
    // Harden into SOLID near existing SOLID
    if (random() < 10 && random() < 10) {
      if (world.borderingAdjacent(tx, ty, idx, MatterType.SOLID) !== -1) {
        world.tiles[idx] = SOLID
        world.markDirty(tx, ty)
        return
      }
    }

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx,                        ty + 1, CONCRETE, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, CONCRETE, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ?  1 : -1), ty + 1, CONCRETE, next)

    if (!moved) {
      // Slow harden even without adjacent solid
      if (random() < 10 && random() < 10 && random() < 5) {
        world.tiles[idx] = SOLID
        world.markDirty(tx, ty)
        return
      }
      world.tiles[idx] = CONCRETE | SETTLED_FLAG
      world.markDirty(tx, ty)
    }
  },
}

export default def
