import { random } from '../../../helpers/random'
import { EMPTY, STEAM, WATER } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: STEAM,
  name: 'Steam',
  lavaImmune: true,
  action(world, tx, ty, idx, next): void {
    const { tiles, width } = world

    // Rise upward (primary movement)
    if (random() < 70) {
      if (world.tryRise(idx, tx, ty, next)) return
    }

    // Spread sideways
    const leftFirst = world.leftFirst
    if (
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1, next)
    ) return

    // Condense near water
    if (random() < 5 && world.bordering(tx, ty, idx, WATER) !== -1) {
      tiles[idx] = WATER
      world.markDirty(tx, ty)
      next.add(idx)
      return
    }

    // Slow disappearance when trapped
    if (random() < 1 && random() < 5) {
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
