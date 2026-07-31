import { type MatterDef, OIL, SALT_WATER, SAND, WATER } from '../_Matter.types.ts'

export const SAND_DEF = {
  id: SAND,
  name: 'Sand',
  collidesWhenSettled: true as const,
  sinksThrough: [WATER, OIL, SALT_WATER],
  settles: true as const,
  lavaBurnable: true as const,
  acidMeltable: true as const,
  action(sim, tx, ty, idx): void {
    sim.doPowderFall(tx, ty, idx)
  },
} satisfies MatterDef

export default SAND_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [SAND]: typeof SAND_DEF;
  }
}