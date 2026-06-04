import { FALLING_WAX, FIRE } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

export const WAX_DEF: ElementDef = {
  name: 'Wax',
  passive: true,
  action(world, tx, ty, idx, next): void {
    // Melt to falling wax near fire
    if (world.borderingAdjacent(tx, ty, idx, FIRE) !== -1) {
      world.tiles[idx] = FALLING_WAX
      world.markDirty(tx, ty)
      next.add(idx)
    }
  },
}
