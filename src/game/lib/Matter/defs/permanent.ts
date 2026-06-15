import { type MatterDef, PERMANENT } from '../_Matter.types.ts'

export const PERMANENT_DEF = {
  id: PERMANENT,
  name: 'Permanent',
  passive: true,
  lavaImmune: true,
  acidImmune: true,
} satisfies MatterDef

export default PERMANENT_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [PERMANENT]: typeof PERMANENT_DEF;
  }
}