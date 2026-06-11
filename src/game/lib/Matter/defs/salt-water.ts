import { type MatterDef, LAVA, OIL, SALT, SALT_WATER, setSettled, WATER } from '../_Matter-types.ts'

export const SALT_WATER_DEF: MatterDef = {
  name: 'Salt Water',
  lavaImmune: true,
  acidImmune: true,
  liquid: true,
  action(world, tx, ty, idx): void {
    world.wakeSettledNeighbors(tx, ty, idx, LAVA)
    world.wakeSettledNeighbors(tx, ty, idx, SALT)

    const moved = world.tryLiquidFlow(tx, ty, idx)
    if (moved) return

    // Salt water is denser than fresh water and oil — sink through them
    if (world.doDensityLiquid(tx, ty, idx, WATER, 25, 25)) return
    if (world.doDensityLiquid(tx, ty, idx, OIL, 25, 25)) return
    if (world.hasDensityBelow(tx, ty, WATER) || world.hasDensityBelow(tx, ty, OIL)) {
      world.next.add(idx)
      return
    }

    world.tiles[idx] = setSettled(SALT_WATER, true)
    world.markDirty(tx, ty)
  },
}