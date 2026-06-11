import { random } from '../../../helpers/random'
import {
  BURNING_THERMITE,
  type MatterDef,
  FIRE,
  OIL,
  SALT_WATER,
  setSettled,
  THERMITE,
  WATER,
} from '../_Matter-types.ts'

export const THERMITE_DEF: MatterDef = {
  name: 'Thermite',
  collidesWhenSettled: true,
  sinksThrough: [WATER, SALT_WATER, OIL],
  action(world, tx, ty, idx, next): void {
    if (world.surroundedByAdjacent(tx, ty, idx, THERMITE)) {
      world.tiles[idx] = setSettled(THERMITE, true)
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
      world.tryMove(idx, tx, ty, tx, ty + 1, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, next)

    if (!moved) {
      world.tiles[idx] = setSettled(THERMITE, true)
      world.markDirty(tx, ty)
    }
  },
}