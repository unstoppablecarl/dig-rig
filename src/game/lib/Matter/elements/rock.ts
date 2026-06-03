import { MatterType, ROCK, SETTLED_FLAG } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.ROCK,
  name: 'Rock',
  lavaImmune: true,
  sinksThrough: [MatterType.WATER, MatterType.OIL, MatterType.SALT_WATER, MatterType.LAVA, MatterType.ACID],
  action(world, tx, ty, idx, next): void {
    const leftFirst = world.leftFirst

    const moved =
      world.tryMove(idx, tx, ty, tx,                        ty + 1, ROCK, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, ROCK, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ?  1 : -1), ty + 1, ROCK, next)

    if (!moved) {
      world.tiles[idx] = ROCK | SETTLED_FLAG
      world.markDirty(tx, ty)
    }
  },
}

export default def
