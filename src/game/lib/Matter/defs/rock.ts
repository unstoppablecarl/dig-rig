import { ACID, LAVA, type MatterDef, OIL, ROCK, SALT_WATER, WATER } from '../_Matter.types.ts'

export const ROCK_DEF = {
  id: ROCK,
  name: 'Rock',
  lavaImmune: true,
  collidesWhenSettled: true,
  sinksThrough: [WATER, OIL, SALT_WATER, LAVA, ACID],
  action(sim, tx, ty, idx): void {
    sim.doPowderFall(tx, ty, idx)
  },
} satisfies MatterDef

export default ROCK_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [ROCK]: typeof ROCK_DEF;
  }
}