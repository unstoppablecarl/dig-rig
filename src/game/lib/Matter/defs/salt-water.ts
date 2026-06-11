import { type MatterDef, LAVA, OIL, SALT, SALT_WATER, setSettled, WATER } from '../_Matter-types.ts'

export const SALT_WATER_DEF: MatterDef = {
  name: 'Salt Water',
  lavaImmune: true,
  acidImmune: true,
  liquid: true,
  action(world, tx, ty, idx, next): void {
    world.wakeSettledNeighbors(tx, ty, idx, LAVA, next)
    world.wakeSettledNeighbors(tx, ty, idx, SALT, next)

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx, ty + 1, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1, next)

    if (moved) return

    // Salt water is denser than fresh water and oil — sink through them
    if (world.doDensityLiquid(tx, ty, idx, next, WATER, 25, 25)) return
    if (world.doDensityLiquid(tx, ty, idx, next, OIL, 25, 25)) return
    if (world.hasDensityBelow(tx, ty, WATER) || world.hasDensityBelow(tx, ty, OIL)) {
      next.add(idx)
      return
    }

    world.tiles[idx] = setSettled(SALT_WATER, true)
    world.markDirty(tx, ty)
  },
}