import { CONCRETE, MatterType, SETTLED_FLAG, SOLID } from '../_Matter-types.ts'
import { rng } from '../MatterWorld.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.CONCRETE,
  name: 'Concrete',
  action(world, tx, ty, idx, next): void {
    // Harden into SOLID near existing SOLID
    if (rng() < 10 && rng() < 10) {
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
      if (rng() < 10 && rng() < 10 && rng() < 5) {
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
