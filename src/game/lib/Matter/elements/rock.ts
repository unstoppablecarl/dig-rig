import { ACID, LAVA, OIL, ROCK, SALT_WATER, setSettled, WATER } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: ROCK,
  name: 'Rock',
  lavaImmune: true,
  collidesWhenSettled: true,
  sinksThrough: [WATER, OIL, SALT_WATER, LAVA, ACID],
  action(world, tx, ty, idx, next): void {
    const leftFirst = world.leftFirst

    const moved =
      world.tryMove(idx, tx, ty, tx, ty + 1, ROCK, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, ROCK, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, ROCK, next)

    if (!moved) {
      world.tiles[idx] = setSettled(ROCK, true)
      world.markDirty(tx, ty)
    }
  },
}

export default def
