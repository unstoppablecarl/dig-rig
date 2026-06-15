import { random } from '../../../helpers/random'
import { EMPTY, type MatterDef, PLANT, SALT, WATER } from '../_Matter.types.ts'

export const PLANT_DEF = {
  id: PLANT,
  name: 'Plant',
  passive: true as const,
  action(sim, tx, ty, idx): void {
    // Grow into adjacent water
    sim.doGrow(tx, ty, idx, WATER, 50)

    // Die from salt
    if (random() < 5) {
      if (sim.bordering(tx, ty, idx, SALT) !== -1) {
        sim.tiles[idx] = EMPTY
        sim.markDirty(tx, ty)
        sim.reactivateAround(tx, ty)
      }
    }
  },
} satisfies MatterDef

export default PLANT_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [PLANT]: typeof PLANT_DEF;
  }
}