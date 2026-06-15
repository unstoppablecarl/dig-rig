import { type MatterDef, OIL, SALT_WATER, SAND, WATER } from '../_Matter.types.ts'
import { registerMatterType } from '../matter.ts'

export const SAND_DEF = {
  name: 'Sand',
  collidesWhenSettled: true,
  sinksThrough: [WATER, OIL, SALT_WATER],
  action(world, tx, ty, idx): void {
    world.doPowderFall(tx, ty, idx)
  },
} satisfies MatterDef

registerMatterType(SAND, SAND_DEF)

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [SAND]: typeof SAND_DEF;
  }
}