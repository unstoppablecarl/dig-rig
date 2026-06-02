import { random } from '../../../helpers/random'
import { MatterType, SALT, SALT_WATER, SETTLED_FLAG, WATER } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.SALT,
  name: 'Salt',
  action(world, tx, ty, idx, next): void {
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
        next.add(idx)
        next.add(waterLoc)
        return
      }
    }

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx,                        ty + 1, SALT, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, SALT, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ?  1 : -1), ty + 1, SALT, next)

    if (!moved) {
      world.tiles[idx] = SALT | SETTLED_FLAG
      world.markDirty(tx, ty)
    }
  },
}

export default def
