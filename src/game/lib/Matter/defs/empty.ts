import { EMPTY, type MatterDef } from '../_Matter.types.ts'

export const EMPTY_DEF = {
  id: EMPTY,
  name: 'Empty',
  passive: true,
  lavaImmune: true,
  acidImmune: true,
} satisfies MatterDef

export default EMPTY_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [EMPTY]: typeof EMPTY_DEF;
  }
}


