import { random } from '../../../helpers/random'
import { BURNING_THERMITE, FIRE, MatterType, SETTLED_FLAG } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.THERMITE,
  name: 'Thermite',
  sinksThrough: [MatterType.WATER, MatterType.SALT_WATER, MatterType.OIL],
  action(world, tx, ty, idx, next): void {
    if (world.surroundedByAdjacent(tx, ty, idx, MatterType.THERMITE)) {
      world.tiles[idx] = MatterType.THERMITE | SETTLED_FLAG
      world.markDirty(tx, ty)
      return
    }

    // Ignite near fire
    if (random() < 50 && world.borderingAdjacent(tx, ty, idx, FIRE) !== -1) {
      world.tiles[idx] = BURNING_THERMITE
      world.markDirty(tx, ty)
      next.add(idx)
      return
    }

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx, ty + 1, MatterType.THERMITE, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, MatterType.THERMITE, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, MatterType.THERMITE, next)

    if (!moved) {
      world.tiles[idx] = MatterType.THERMITE | SETTLED_FLAG
      world.markDirty(tx, ty)
    }
  },
}

export default def
