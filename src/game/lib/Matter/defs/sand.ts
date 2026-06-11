import { type MatterDef, OIL, SALT_WATER, SAND_SETTLED, WATER } from '../_Matter-types.ts'
import type { MatterSim } from '../MatterSim.ts'

export const SAND_DEF: MatterDef = {
  name: 'Sand',
  collidesWhenSettled: true,
  sinksThrough: [WATER, OIL, SALT_WATER],
  action(world: MatterSim, tx, ty, idx, next): void {
    const leftFirst = world.leftFirst

    const moved =
      world.tryMove(idx, tx, ty, tx, ty + 1, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, next)

    if (!moved) {
      world.tiles[idx] = SAND_SETTLED
      world.markDirty(tx, ty)
      world.justSettled.push(idx)
    }
  },
}