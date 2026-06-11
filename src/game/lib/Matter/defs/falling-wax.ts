import { FIRE, getFirstOwnerId, type MatterDef, setOwner, WAX } from '../_Matter-types.ts'

export const FALLING_WAX_DEF: MatterDef = {
  name: 'Falling Wax',
  action(world, tx, ty, idx): void {
    const moved = world.tryMove(idx, tx, ty, tx, ty + 1)
    if (!moved) {
      const { tiles } = world
      // Catch fire if blocked by fire below (breaks the melt→fall→resolidify cycle)
      const nidx = world.borderingAdjacent(tx, ty, idx, FIRE)
      if (nidx !== -1) {
        const ownerId = getFirstOwnerId(tiles[nidx], tiles[idx])
        world.queueMatterCredit(tx, ty, ownerId)
        tiles[idx] = setOwner(FIRE, ownerId)
        world.markDirty(tx, ty)
        world.next.add(idx)
        return
      }
      tiles[idx] = WAX
      world.markDirty(tx, ty)
    }
  },
}