import { random } from '../../../helpers/random'
import {
  BURNING_THERMITE,
  FIRE,
  type MatterDef,
  OIL,
  SALT_WATER,
  setSettled,
  THERMITE,
  WATER,
} from '../_Matter.types.ts'

export const THERMITE_DEF = {
  id: THERMITE,
  name: 'Thermite',
  collidesWhenSettled: true as const,
  sinksThrough: [WATER, SALT_WATER, OIL],
  action(sim, tx, ty, idx): void {
    if (sim.surroundedByAdjacent(tx, ty, idx, THERMITE)) {
      sim.tiles[idx] = setSettled(THERMITE, true)
      sim.markDirty(tx, ty)
      return
    }

    // Ignite near fire
    if (random() < 50 && sim.borderingAdjacent(tx, ty, idx, FIRE) !== -1) {
      sim.tiles[idx] = BURNING_THERMITE
      sim.markDirty(tx, ty)
      sim.next.add(idx)
      return
    }
    sim.doPowderFall(tx, ty, idx)
  },
} satisfies MatterDef

export default THERMITE_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [THERMITE]: typeof THERMITE_DEF;
  }
}