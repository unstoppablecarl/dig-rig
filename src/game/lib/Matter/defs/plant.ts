import { random } from '../../../helpers/random'
import { type MatterDef, EMPTY, SALT, WATER } from '../_Matter-types.ts'

export const PLANT_DEF: MatterDef = {
  name: 'Plant',
  passive: true,
  action(world, tx, ty, idx, next): void {
    // Grow into adjacent water
    world.doGrow(tx, ty, idx, next, WATER, 50)

    // Die from salt
    if (random() < 5) {
      if (world.bordering(tx, ty, idx, SALT) !== -1) {
        world.tiles[idx] = EMPTY
        world.markDirty(tx, ty)
        world.reactivateAround(tx, ty, next)
      }
    }
  },
}