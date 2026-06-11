import { type MatterDef, OIL, SALT_WATER, WATER } from '../_Matter-types.ts'
import type { MatterSim } from '../MatterSim.ts'

export const SAND_DEF: MatterDef = {
  name: 'Sand',
  collidesWhenSettled: true,
  sinksThrough: [WATER, OIL, SALT_WATER],
  action(world: MatterSim, tx, ty, idx): void {
    const moved = world.doPowderFall(tx, ty, idx)
    if (!moved) {
      world.justSettled.push(idx)
    }
  },
}