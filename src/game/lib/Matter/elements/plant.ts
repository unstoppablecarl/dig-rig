import { MatterType, SALT, WATER } from '../_Matter-types.ts'
import { rng } from '../MatterWorld.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.PLANT,
  name: 'Plant',
  passive: true,
  action(world, tx, ty, idx, next): void {
    // Grow into adjacent water
    world.doGrow(tx, ty, idx, next, WATER, 50)

    // Die from salt
    if (rng() < 5) {
      if (world.bordering(tx, ty, idx, SALT) !== -1) {
        world.tiles[idx] = MatterType.EMPTY
        world.markDirty(tx, ty)
        world.reactivateAround(tx, ty, next)
      }
    }
  },
}

export default def
