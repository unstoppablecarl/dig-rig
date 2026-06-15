import { random } from '../../../helpers/random'
import { CONCRETE, type MatterDef, SALT_WATER, setSettled, SOLID, WATER } from '../_Matter.types.ts'
import { registerMatterType } from '../matter.ts'

export const CONCRETE_DEF = {
  name: 'Concrete',
  collidesWhenSettled: true,
  sinksThrough: [WATER, SALT_WATER],
  action(world, tx, ty, idx): void {
    // Harden into SOLID near existing SOLID
    if (random() < 10 && random() < 10) {
      if (world.borderingAdjacent(tx, ty, idx, SOLID) !== -1) {
        world.tiles[idx] = SOLID
        world.markDirty(tx, ty)
        return
      }
    }

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx, ty + 1) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1)

    if (!moved) {
      // Slow harden even without adjacent solid
      if (random() < 10 && random() < 10 && random() < 5) {
        world.tiles[idx] = SOLID
        world.markDirty(tx, ty)
        return
      }
      world.tiles[idx] = setSettled(CONCRETE, true)
      world.markDirty(tx, ty)
    }
  },
} satisfies MatterDef

registerMatterType(CONCRETE, CONCRETE_DEF)

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [CONCRETE]: typeof CONCRETE_DEF;
  }
}

