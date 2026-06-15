import { random } from '../../../helpers/random'
import {
  BURNING_THERMITE,
  FIRE,
  getFirstOwnerId,
  type MatterDef,
  OIL,
  SALT_WATER,
  setOwner,
  setSettled,
  THERMITE,
  WATER,
} from '../_Matter.types.ts'

export const THERMITE_DEF = {
  id: THERMITE,
  name: 'Thermite',
  collidesWhenSettled: true as const,
  sinksThrough: [WATER, SALT_WATER, OIL],
  hasOwnerId: true as const,
  action(sim, tx, ty, idx): void {
    if (sim.surroundedByAdjacent(tx, ty, idx, THERMITE)) {
      sim.tiles[idx] = setSettled(THERMITE, true)
      sim.markDirty(tx, ty)
      return
    }

    // Ignite near fire
    if (random() < 50) {
      const { tiles } = sim
      const fireIdx = sim.borderingAdjacent(tx, ty, idx, FIRE)
      if (fireIdx !== -1) {
        const existingRaw = tiles[idx]
        const fireRaw = tiles[fireIdx]
        const ownerId = getFirstOwnerId(existingRaw, fireRaw)

        sim.tiles[idx] = setOwner(BURNING_THERMITE, ownerId)
        sim.markDirty(tx, ty)
        sim.next.add(idx)
        return
      }
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