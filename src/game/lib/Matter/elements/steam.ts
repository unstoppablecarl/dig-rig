import { EMPTY, MatterType, STEAM, WATER } from '../_Matter-types.ts'
import { rng } from '../MatterWorld.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.STEAM,
  name: 'Steam',
  action(world, tx, ty, idx, next): void {
    const { tiles, width } = world

    // Rise upward (primary movement)
    if (rng() < 70) {
      if (world.tryRise(idx, tx, ty, next)) return
    }

    // Spread sideways
    const leftFirst = world.leftFirst
    if (
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 :  1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ?  1 : -1, next)
    ) return

    // Condense near water
    if (rng() < 5 && world.bordering(tx, ty, idx, WATER) !== -1) {
      tiles[idx] = WATER
      world.markDirty(tx, ty)
      next.add(idx)
      return
    }

    // Slow disappearance when trapped
    if (rng() < 1 && rng() < 5) {
      // Check nothing below
      if (ty < world.height - 1 && (tiles[(ty + 1) * width + tx] & 0x7F) !== STEAM) {
        tiles[idx] = EMPTY
        world.markDirty(tx, ty)
        world.reactivateAround(tx, ty, next)
        return
      }
    }

    next.add(idx)
  },
}

export default def
