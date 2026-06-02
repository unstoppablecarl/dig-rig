import { MatterType, SAND, SAND_SETTLED, WATER } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.WATER,
  name: 'Water',
  action(world, tx, ty, idx, next): void {
    let leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx, ty + 1, WATER, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, WATER, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, WATER, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1, next)

    if (!moved) {
      world.stableWater.add(idx)
      // Wake SAND_SETTLED directly above — it should sink through water
      if (ty > 0) {
        const aboveIdx = (ty - 1) * world.width + tx
        if (world.tiles[aboveIdx] === SAND_SETTLED) {
          world.tiles[aboveIdx] = SAND
          world.markDirty(tx, ty - 1)
          next.add(aboveIdx)
        }
      }
    }
  },
}

export default def
