import { EMPTY, type MatterDef } from '../_Matter.types.ts'

export const EMPTY_DEF = {
  id: EMPTY,
  name: 'Empty',
  lavaImmune: true as const,
  acidImmune: true as const,
  collidesWithCreateProjectiles: false as const,
} satisfies MatterDef

export default EMPTY_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [EMPTY]: typeof EMPTY_DEF;
  }
}


