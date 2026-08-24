import { type MatterDef, SAND, SOLID, SupportType } from '../_Matter.types.ts'

export const SOLID_DEF = {
  id: SOLID,
  name: 'Solid',
  immutableSupport: SupportType.STRUCTURAL as const,
  structuralCollapseType: SAND,
  alwaysCollides: true as const,
  lavaMeltable: true as const,
  acidMeltable: true as const,
} satisfies MatterDef

export default SOLID_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [SOLID]: typeof SOLID_DEF;
  }
}
