import { random } from '../../../helpers/random'
import { type MatterDef, SALT_WATER, WATER } from '../_Matter.types.ts'

export const SALT_DEF: MatterDef = {
  name: 'Salt',
  collidesWhenSettled: true,
  sinksThrough: [WATER, SALT_WATER],
  action(world, tx, ty, idx): void {
    // Dissolve in water → salt water
    if (random() < 25) {
      const waterLoc = world.bordering(tx, ty, idx, WATER)
      if (waterLoc !== -1) {
        world.tiles[idx] = SALT_WATER
        world.tiles[waterLoc] = SALT_WATER
        world.markDirty(tx, ty)
        const wx = waterLoc % world.width
        const wy = waterLoc / world.width | 0
        world.markDirty(wx, wy)
        world.next.add(idx)
        world.next.add(waterLoc)
        return
      }
    }

    world.doPowderFall(tx, ty, idx)
  },
}