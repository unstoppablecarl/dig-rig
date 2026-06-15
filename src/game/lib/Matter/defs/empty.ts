import { EMPTY, type MatterDef } from '../_Matter.types.ts'
import { registerMatterType } from '../matter.ts'

export const EMPTY_DEF = {
  name: 'Empty',
  passive: true,
  lavaImmune: true,
  acidImmune: true,
} satisfies MatterDef

registerMatterType(EMPTY, EMPTY_DEF)

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [EMPTY]: typeof EMPTY_DEF;
  }
}


