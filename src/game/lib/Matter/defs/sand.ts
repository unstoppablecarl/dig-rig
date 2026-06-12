import { type MatterDef, OIL, SALT_WATER, WATER } from '../_Matter-types.ts'

export const SAND_DEF: MatterDef = {
  name: 'Sand',
  collidesWhenSettled: true,
  sinksThrough: [WATER, OIL, SALT_WATER],
  action(world, tx, ty, idx): void {
    world.doPowderFall(tx, ty, idx)
  },
}