import { random } from '../../../helpers/random'
import { FILL_MAX } from '../_Liquid.constants.ts'
import { type MatterDef, SALT, SALT_WATER, WATER } from '../_Matter.types.ts'

export const SALT_DEF = {
  id: SALT,
  name: 'Salt',
  settles: true as const,
  collidesWhenSettled: true as const,
  sinksThrough: [WATER, SALT_WATER],
  action(sim, tx, ty, idx): void {
    // Dissolve in water → salt water
    if (random() < 25) {
      const waterLoc = sim.bordering(tx, ty, idx, WATER)
      if (waterLoc !== -1) {
        sim.notifySolidConsumed()
        sim.consumeLiquidFill(idx)
        sim.notifyLiquidCreated()
        sim.fill[idx] = FILL_MAX
        sim.tiles[idx] = SALT_WATER
        sim.consumeLiquidFill(waterLoc)
        sim.notifyLiquidCreated()
        sim.fill[waterLoc] = FILL_MAX
        sim.tiles[waterLoc] = SALT_WATER
        sim.markDirty(tx, ty)
        const wx = waterLoc % sim.width
        const wy = waterLoc / sim.width | 0
        sim.markDirty(wx, wy)
        sim.next.add(idx)
        sim.next.add(waterLoc)
        return
      }
    }

    sim.doPowderFall(tx, ty, idx)
  },
} satisfies MatterDef

export default SALT_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [SALT]: typeof SALT_DEF;
  }
}