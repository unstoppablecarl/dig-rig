import { random } from '../../../helpers/random'
import { FIRE, ICE, LAVA, type MatterDef, SALT, SALT_WATER, STEAM, WATER } from '../_Matter.types.ts'
import { MatterTypeSet } from '../data/MatterTypeSet'

const MELT_SLOW = new MatterTypeSet(SALT, SALT_WATER)
const MELT_FAST = new MatterTypeSet(FIRE, LAVA)

export const ICE_DEF = {
  id: ICE,
  name: 'Ice',
  passive: true as const,
  acidImmune: true as const,
  action(sim, tx, ty, idx): void {
    // Surrounded by ice — fully stable
    if (sim.surroundedBy(tx, ty, idx, ICE)) return

    // Melt from water
    if (random() < 1 && sim.bordering(tx, ty, idx, WATER) !== -1) {
      sim.tiles[idx] = WATER
      sim.markDirty(tx, ty)
      sim.next.add(idx)
      return
    }

    // Melt from steam
    if (random() < 70 && sim.bordering(tx, ty, idx, STEAM) !== -1) {
      sim.tiles[idx] = WATER
      sim.markDirty(tx, ty)
      sim.next.add(idx)
      return
    }

    // Melt from salt / salt-water
    if (random() < 10) {
      if (sim.borderingAny(tx, ty, idx, MELT_SLOW) !== -1) {
        sim.tiles[idx] = WATER
        sim.markDirty(tx, ty)
        sim.next.add(idx)
        return
      }
    }

    // Melt from fire / lava
    if (random() < 50) {
      if (sim.borderingAny(tx, ty, idx, MELT_FAST) !== -1) {
        sim.tiles[idx] = WATER
        sim.markDirty(tx, ty)
        sim.next.add(idx)
        return
      }
    }
  },
} satisfies MatterDef

export default ICE_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [ICE]: typeof ICE_DEF;
  }
}