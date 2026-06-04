import { LAVA, matterType, OIL, SALT, SAND, WATER, WATER_SETTLED } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

export const WATER_DEF: ElementDef = {
  name: 'Water',
  lavaImmune: true,
  acidImmune: true,
  liquid: true,
  action(world, tx, ty, idx, next): void {
    world.wakeSettledNeighbors(tx, ty, idx, LAVA, next)
    world.wakeSettledNeighbors(tx, ty, idx, SALT, next)

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx, ty + 1, WATER, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, WATER, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, WATER, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1, next)

    if (moved) return

    // Water is denser than oil — sink through it
    if (world.doDensityLiquid(tx, ty, idx, next, OIL, 25, 50)) return
    // Probability roll may have missed — stay active so we retry next frame
    if (world.hasDensityBelow(tx, ty, OIL)) {
      next.add(idx)
      return
    }

    world.tiles[idx] = WATER_SETTLED
    world.markDirty(tx, ty)

    // Wake settled SAND directly above — it should sink through water
    if (ty > 0) {
      const aboveIdx = (ty - 1) * world.width + tx
      const raw = world.tiles[aboveIdx]
      if (matterType(raw) === SAND) {
        world.tiles[aboveIdx] = SAND
        world.markDirty(tx, ty - 1)
        next.add(aboveIdx)
      }
    }
  },
}
