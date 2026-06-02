import { FALLING_WAX, MatterType, WAX } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.FALLING_WAX,
  name: 'Falling Wax',
  action(world, tx, ty, idx, next): void {
    const moved = world.tryMove(idx, tx, ty, tx, ty + 1, FALLING_WAX, next)
    if (!moved) {
      // Solidify back to wax when it can't fall
      world.tiles[idx] = WAX
      world.markDirty(tx, ty)
    }
  },
}

export default def
