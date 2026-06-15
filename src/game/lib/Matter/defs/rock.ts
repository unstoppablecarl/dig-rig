import { ACID, LAVA, type MatterDef, OIL, ROCK, SALT_WATER, WATER } from '../_Matter.types.ts'
import { registerMatterType } from '../matter.ts'

export const ROCK_DEF = {
  name: 'Rock',
  lavaImmune: true,
  collidesWhenSettled: true,
  sinksThrough: [WATER, OIL, SALT_WATER, LAVA, ACID],
  action(world, tx, ty, idx): void {
    world.doPowderFall(tx, ty, idx)
  },
} satisfies MatterDef

registerMatterType(ROCK, ROCK_DEF)

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [ROCK]: typeof ROCK_DEF;
  }
}