import { LAVA, MatterType, OIL, SALT_WATER, SETTLED_FLAG, WATER } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.SALT_WATER,
  name: 'Salt Water',
  action(world, tx, ty, idx, next): void {
    world.wakeSettledNeighbors(tx, ty, idx, LAVA, next)

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx, ty + 1, SALT_WATER, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, SALT_WATER, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, SALT_WATER, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1, next)

    if (moved) return

    // Salt water is denser than fresh water and oil — sink through them
    if (world.doDensityLiquid(tx, ty, idx, next, WATER, 25, 25)) return
    if (world.doDensityLiquid(tx, ty, idx, next, OIL, 25, 25)) return
    if (world.hasDensityBelow(tx, ty, WATER) || world.hasDensityBelow(tx, ty, OIL)) {
      next.add(idx)
      return
    }

    world.tiles[idx] = SALT_WATER | SETTLED_FLAG
    world.markDirty(tx, ty)
  },
}

export default def
