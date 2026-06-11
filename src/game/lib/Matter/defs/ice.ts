import { random } from '../../../helpers/random'
import { FIRE, ICE, LAVA, type MatterDef, MatterTypeSet, SALT, SALT_WATER, STEAM, WATER } from '../_Matter-types.ts'

const MELT_SLOW = new MatterTypeSet(SALT, SALT_WATER)
const MELT_FAST = new MatterTypeSet(FIRE, LAVA)

export const ICE_DEF: MatterDef = {
  name: 'Ice',
  passive: true,
  acidImmune: true,
  action(world, tx, ty, idx, next): void {
    // Surrounded by ice — fully stable
    if (world.surroundedBy(tx, ty, idx, ICE)) return

    // Melt from water
    if (random() < 1 && world.bordering(tx, ty, idx, WATER) !== -1) {
      world.tiles[idx] = WATER
      world.markDirty(tx, ty)
      next.add(idx)
      return
    }

    // Melt from steam
    if (random() < 70 && world.bordering(tx, ty, idx, STEAM) !== -1) {
      world.tiles[idx] = WATER
      world.markDirty(tx, ty)
      next.add(idx)
      return
    }

    // Melt from salt / salt-water
    if (random() < 10) {
      if (world.borderingAny(tx, ty, idx, MELT_SLOW) !== -1) {
        world.tiles[idx] = WATER
        world.markDirty(tx, ty)
        next.add(idx)
        return
      }
    }

    // Melt from fire / lava
    if (random() < 50) {
      if (world.borderingAny(tx, ty, idx, MELT_FAST) !== -1) {
        world.tiles[idx] = WATER
        world.markDirty(tx, ty)
        next.add(idx)
        return
      }
    }
  },
}