import { random } from '../../../helpers/random'
import { FIRE, getFirstOwnerId, type MatterDef, OIL, setSettled } from '../_Matter.types.ts'
import { registerMatterType } from '../matter.ts'

export const OIL_DEF = {
  name: 'Oil',
  liquid: true,
  action(world, tx, ty, idx): void {
    if (random() < 30) {
      const nidx = world.bordering(tx, ty, idx, FIRE)
      if (nidx !== -1) {
        const tiles = world.tiles

        // oil owner or fallback to fire owner
        const ownerId = getFirstOwnerId(tiles[idx], tiles[nidx])
        world.doBorderBurn(tx, ty, idx, ownerId)
      }
    }

    const moved = world.tryLiquidFlow(tx, ty, idx)
    if (!moved) {
      world.tiles[idx] = setSettled(OIL, true)
      world.markDirty(tx, ty)
    }
  },
} satisfies MatterDef

registerMatterType(OIL, OIL_DEF)

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [OIL]: typeof OIL_DEF;
  }
}
