import { LAVA, type MatterDef, OIL, SALT, SALT_WATER, setSettled, WATER } from '../_Matter.types.ts'
import { registerMatterType } from '../matter.ts'

export const SALT_WATER_DEF = {
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
} satisfies MatterDef

registerMatterType(SALT_WATER, SALT_WATER_DEF)

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [SALT_WATER]: typeof SALT_WATER_DEF;
  }
}