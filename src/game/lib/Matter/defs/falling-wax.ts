import { type MatterDef, FALLING_WAX, FIRE, WAX } from '../_Matter-types.ts'

export const FALLING_WAX_DEF: MatterDef = {
  name: 'Falling Wax',
  action(world, tx, ty, idx, next): void {
    const moved = world.tryMove(idx, tx, ty, tx, ty + 1, FALLING_WAX, next)
    if (!moved) {
      // Catch fire if blocked by fire below (breaks the melt→fall→resolidify cycle)
      if (world.borderingAdjacent(tx, ty, idx, FIRE) !== -1) {
        world.tiles[idx] = FIRE
        world.markDirty(tx, ty)
        next.add(idx)
        return
      }
      world.tiles[idx] = WAX
      world.markDirty(tx, ty)
    }
  },
}