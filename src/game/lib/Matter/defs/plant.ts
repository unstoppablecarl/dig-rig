import { random } from '../../../helpers/random'
import { EMPTY, type MatterDef, PLANT, SALT, WATER } from '../_Matter.types.ts'
import { registerMatterType } from '../matter.ts'

export const PLANT_DEF = {
  name: 'Plant',
  passive: true,
  action(world, tx, ty, idx): void {
    // Grow into adjacent water
    world.doGrow(tx, ty, idx, WATER, 50)

    // Die from salt
    if (random() < 5) {
      if (world.bordering(tx, ty, idx, SALT) !== -1) {
        world.tiles[idx] = EMPTY
        world.markDirty(tx, ty)
        world.reactivateAround(tx, ty)
      }
    }
  },
} satisfies MatterDef

registerMatterType(PLANT, PLANT_DEF)

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [PLANT]: typeof PLANT_DEF;
  }
}