import { EMPTY, type MatterDef } from '../_Matter.types.ts'

export const EMPTY_DEF = {
  id: EMPTY,
  name: 'Empty',
  collidesWithCreateProjectiles: false as const,
  collidesWithDestroyProjectiles: false as const,
} satisfies MatterDef

export default EMPTY_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [EMPTY]: typeof EMPTY_DEF;
  }
}


