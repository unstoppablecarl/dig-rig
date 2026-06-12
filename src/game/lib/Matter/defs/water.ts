import { LAVA, type MatterDef, matterType, OIL, SALT, SAND, WATER_SETTLED } from '../_Matter.types.ts'

export const WATER_DEF: MatterDef = {
  name: 'Water',
  lavaImmune: true,
  acidImmune: true,
  liquid: true,
  action(world, tx, ty, idx): void {
    world.wakeSettledNeighbors(tx, ty, idx, LAVA)
    world.wakeSettledNeighbors(tx, ty, idx, SALT)

    const moved = world.tryLiquidFlow(tx, ty, idx)
    if (moved) return

    // Water is denser than oil — sink through it
    if (world.doDensityLiquid(tx, ty, idx, OIL, 25, 50)) return
    // Probability roll may have missed — stay active so we retry next frame
    if (world.hasDensityBelow(tx, ty, OIL)) {
      world.next.add(idx)
      return
    }

    world.tiles[idx] = WATER_SETTLED
    world.markDirty(tx, ty)

    // Wake settled SAND directly above — it should sink through water
    if (ty > 0) {
      const aboveIdx = (ty - 1) * world.width + tx
      const raw = world.tiles[aboveIdx]
      if (matterType(raw) === SAND) {
        // un settle sand
        world.tiles[aboveIdx] = SAND
        world.markDirty(tx, ty - 1)
        world.next.add(aboveIdx)
      }
    }
  },
}
