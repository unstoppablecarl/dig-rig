import { random } from '../../../helpers/random'
import { FIRE, ICE, LAVA, MatterType, SALT, SALT_WATER, STEAM, WATER } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.ICE,
  name: 'Ice',
  passive: true,
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
      let loc = world.bordering(tx, ty, idx, SALT)
      if (loc === -1) loc = world.bordering(tx, ty, idx, SALT_WATER)
      if (loc !== -1) {
        world.tiles[idx] = WATER
        world.markDirty(tx, ty)
        next.add(idx)
        return
      }
    }

    // Melt from fire / lava
    if (random() < 50) {
      let loc = world.bordering(tx, ty, idx, FIRE)
      if (loc === -1) loc = world.bordering(tx, ty, idx, LAVA)
      if (loc !== -1) {
        world.tiles[idx] = WATER
        world.markDirty(tx, ty)
        next.add(idx)
        return
      }
    }
  },
}

export default def
