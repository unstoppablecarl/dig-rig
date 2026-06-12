import { random } from '../../../helpers/random'
import {
  BURNING_THERMITE,
  FIRE,
  type MatterDef,
  OIL,
  SALT_WATER,
  setSettled,
  THERMITE,
  WATER,
} from '../_Matter.types.ts'

export const THERMITE_DEF: MatterDef = {
  name: 'Thermite',
  collidesWhenSettled: true,
  sinksThrough: [WATER, SALT_WATER, OIL],
  action(world, tx, ty, idx): void {
    if (world.surroundedByAdjacent(tx, ty, idx, THERMITE)) {
      world.tiles[idx] = setSettled(THERMITE, true)
      world.markDirty(tx, ty)
      return
    }

    // Ignite near fire
    if (random() < 50 && world.borderingAdjacent(tx, ty, idx, FIRE) !== -1) {
      world.tiles[idx] = BURNING_THERMITE
      world.markDirty(tx, ty)
      world.next.add(idx)
      return
    }
    world.doPowderFall(tx, ty, idx)
  },
}