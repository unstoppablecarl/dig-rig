import { random } from '../../../helpers/random'
import { CHILLED_ICE, FIRE, ICE, LAVA, SALT, SALT_WATER, STEAM, WATER } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: CHILLED_ICE,
  name: 'Chilled Ice',
  passive: true,
  acidImmune: true,
  action(world, tx, ty, idx, next): void {
    // Thaw to regular ice
    if (random() < 6) {
      world.tiles[idx] = ICE
      world.markDirty(tx, ty)
      next.add(idx)
      return
    }

    // Fast thaw near heat or salt
    if (
      world.bordering(tx, ty, idx, SALT) !== -1 ||
      world.bordering(tx, ty, idx, SALT_WATER) !== -1 ||
      world.bordering(tx, ty, idx, LAVA) !== -1 ||
      world.bordering(tx, ty, idx, FIRE) !== -1 ||
      world.bordering(tx, ty, idx, STEAM) !== -1
    ) {
      world.tiles[idx] = ICE
      world.markDirty(tx, ty)
      next.add(idx)
      return
    }

    // Freeze adjacent water
    world.doGrow(tx, ty, idx, next, WATER, 50)
  },
}

export default def
