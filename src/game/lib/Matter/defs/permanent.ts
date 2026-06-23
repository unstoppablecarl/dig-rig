import { type MatterDef, PERMANENT, SupportType } from '../_Matter.types.ts'

export const PERMANENT_DEF = {
  id: PERMANENT,
  name: 'Permanent',
  lavaImmune: true as const,
  acidImmune: true as const,
  alwaysCollides: true as const,
  immutableSupport: SupportType.ANCHORED as const,
} satisfies MatterDef

export default PERMANENT_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [PERMANENT]: typeof PERMANENT_DEF;
  }
}