import { type MatterDef, PERMANENT } from '../_Matter.types.ts'
import { registerMatterType } from '../matter.ts'

export const PERMANENT_DEF = {
  name: 'Permanent',
  passive: true,
  lavaImmune: true,
  acidImmune: true,
} satisfies MatterDef

registerMatterType(PERMANENT, PERMANENT_DEF)

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [PERMANENT]: typeof PERMANENT_DEF;
  }
}