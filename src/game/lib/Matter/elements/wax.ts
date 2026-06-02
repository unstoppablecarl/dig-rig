import { FALLING_WAX, FIRE, MatterType } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.WAX,
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

export default def
