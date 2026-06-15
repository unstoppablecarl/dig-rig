import { type MatterDef, OIL, SALT_WATER, SAND, WATER } from '../_Matter.types.ts'

export const SAND_DEF = {
  id: SAND,
  name: 'Sand',
  collidesWhenSettled: true,
  sinksThrough: [WATER, OIL, SALT_WATER],
  action(world, tx, ty, idx): void {
    world.doPowderFall(tx, ty, idx)
  },
} satisfies MatterDef

export default SAND_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [SAND]: typeof SAND_DEF;
  }
}