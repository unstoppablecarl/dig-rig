import { random } from '../../../helpers/random'
import {
  EMPTY,
  FIRE,
  getCounter,
  getOwner,
  hasCounter,
  type MatterDef,
  PLANT,
  SALT,
  setCounter,
  setOwner,
  SupportType,
  WATER,
} from '../_Matter.types.ts'

export const PLANT_DEF = {
  id: PLANT,
  name: 'Plant',
  immutableSupport: SupportType.AFFIXED as const,
  action(sim, tx, ty, idx): void {
    const { tiles, width } = sim

    if (hasCounter(tiles[idx])) {
      const counter = getCounter(tiles[idx])
      const ownerId = getOwner(tiles[idx])

      const emptyLoc = sim.borderingAdjacent(tx, ty, idx, EMPTY)
      if (emptyLoc !== -1) {
        tiles[emptyLoc] = setOwner(FIRE, ownerId)
        sim.markDirty(emptyLoc % width, emptyLoc / width | 0)
        sim.next.add(emptyLoc)
      }

      if (counter <= 1) {
        sim.queueMatterCredit(tx, ty, ownerId)
        tiles[idx] = EMPTY
        sim.markDirty(tx, ty)
        sim.reactivateAround(tx, ty)
      } else {
        tiles[idx] = setCounter(tiles[idx], counter - 1)
        sim.markDirty(tx, ty)
        sim.next.add(idx)
      }
      return
    }

    // Grow into adjacent water
    sim.doGrow(tx, ty, idx, WATER, 50)

    // Die from salt
    if (random() < 5) {
      if (sim.bordering(tx, ty, idx, SALT) !== -1) {
        tiles[idx] = EMPTY
        sim.markDirty(tx, ty)
        sim.reactivateAround(tx, ty)
        return
      }
    }

    sim.next.add(idx)
  },
} satisfies MatterDef

export default PLANT_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [PLANT]: typeof PLANT_DEF;
  }
}
