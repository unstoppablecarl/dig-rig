import { ACID, LAVA, type MatterDef, OIL, SALT_WATER, WATER } from '../_Matter.types.ts'

export const ROCK_DEF: MatterDef = {
  name: 'Rock',
  lavaImmune: true,
  collidesWhenSettled: true,
  sinksThrough: [WATER, OIL, SALT_WATER, LAVA, ACID],
  action(world, tx, ty, idx): void {
    world.doPowderFall(tx, ty, idx)
  },
}