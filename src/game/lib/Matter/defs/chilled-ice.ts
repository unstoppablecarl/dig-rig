import { random } from '../../../helpers/random'
import { FIRE, ICE, LAVA, type MatterDef, MatterTypeSet, SALT, SALT_WATER, STEAM, WATER } from '../_Matter-types.ts'

const FAST_THAW_TARGETS = new MatterTypeSet(SALT, SALT_WATER, LAVA, FIRE, STEAM)

export const CHILLED_ICE_DEF: MatterDef = {
  name: 'Chilled Ice',
  passive: true,
  acidImmune: true,
  action(world, tx, ty, idx): void {
    // Thaw to regular ice
    if (random() < 6) {
      world.tiles[idx] = ICE
      world.markDirty(tx, ty)
      world.next.add(idx)
      return
    }

    // Fast thaw near heat or salt
    if (world.borderingAny(tx, ty, idx, FAST_THAW_TARGETS) !== -1) {
      world.tiles[idx] = ICE
      world.markDirty(tx, ty)
      world.next.add(idx)
      return
    }

    // Freeze adjacent water
    world.doGrow(tx, ty, idx, WATER, 50)
  },
}
