import { random } from '../../../helpers/random'
import { type MatterDef, matterType, STEAM, WATER } from '../_Matter.types.ts'

export const STEAM_DEF = {
  id: STEAM,
  name: 'Steam',
  lavaImmune: true as const,
  alwaysActive: true as const,
  action(sim, tx, ty, idx): void {
    const { tiles, width } = sim

    // Rise upward (primary movement)
    if (random() < 70) {
      if (sim.tryRise(idx, tx, ty)) return
    }

    // Spread sideways
    const leftFirst = sim.leftFirst
    if (
      sim.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1) ||
      sim.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1)
    ) return

    // Condense near water
    if (random() < 5 && sim.bordering(tx, ty, idx, WATER) !== -1) {
      tiles[idx] = WATER
      sim.markDirty(tx, ty)
      sim.next.add(idx)
      return
    }

    // Slow condense when trapped
    if (random() < 1 && random() < 5) {
      // Check nothing below
      if (ty < sim.height - 1 && matterType(tiles[(ty + 1) * width + tx]) !== STEAM) {
        tiles[idx] = WATER
        sim.markDirty(tx, ty)
        sim.reactivateAround(tx, ty)
        return
      }
    }

    sim.next.add(idx)
  },
} satisfies MatterDef

export default STEAM_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [STEAM]: typeof STEAM_DEF;
  }
}
