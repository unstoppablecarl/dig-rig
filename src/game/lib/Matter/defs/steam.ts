import { random } from '../../../helpers/random'
import { type MatterDef, matterType, STEAM, WATER } from '../_Matter-types.ts'

export const STEAM_DEF: MatterDef = {
  name: 'Steam',
  lavaImmune: true,
  action(world, tx, ty, idx): void {
    const { tiles, width } = world

    // Rise upward (primary movement)
    if (random() < 70) {
      if (world.tryRise(idx, tx, ty)) return
    }

    // Spread sideways
    const leftFirst = world.leftFirst
    if (
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1)
    ) return

    // Condense near water
    if (random() < 5 && world.bordering(tx, ty, idx, WATER) !== -1) {
      tiles[idx] = WATER
      world.markDirty(tx, ty)
      world.next.add(idx)
      return
    }

    // Slow condense when trapped
    if (random() < 1 && random() < 5) {
      // Check nothing below
      if (ty < world.height - 1 && matterType(tiles[(ty + 1) * width + tx]) !== STEAM) {
        tiles[idx] = WATER
        world.markDirty(tx, ty)
        world.reactivateAround(tx, ty)
        return
      }
    }

    world.next.add(idx)
  },
}
