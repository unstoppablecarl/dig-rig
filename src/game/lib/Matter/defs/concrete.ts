import { random } from '../../../helpers/random'
import { CONCRETE, type MatterDef, SALT_WATER, setSettled, SOLID, WATER } from '../_Matter.types.ts'

export const CONCRETE_DEF = {
  id: CONCRETE,
  name: 'Concrete',
  collidesWhenSettled: true as const,
  sinksThrough: [WATER, SALT_WATER],
  action(sim, tx, ty, idx): void {
    // Harden into SOLID near existing SOLID
    if (random() < 10 && random() < 10) {
      if (sim.borderingAdjacent(tx, ty, idx, SOLID) !== -1) {
        sim.tiles[idx] = SOLID
        sim.markDirty(tx, ty)
        return
      }
    }

    const leftFirst = sim.leftFirst
    const moved =
      sim.tryMove(idx, tx, ty, tx, ty + 1) ||
      sim.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1) ||
      sim.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1)

    if (!moved) {
      // Slow harden even without adjacent solid
      if (random() < 10 && random() < 10 && random() < 5) {
        sim.tiles[idx] = SOLID
        sim.markDirty(tx, ty)
        return
      }
      sim.tiles[idx] = setSettled(CONCRETE, true)
      sim.markDirty(tx, ty)
    }
  },
} satisfies MatterDef

export default CONCRETE_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [CONCRETE]: typeof CONCRETE_DEF;
  }
}

