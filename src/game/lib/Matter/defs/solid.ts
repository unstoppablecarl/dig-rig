import { type MatterDef, SAND, SOLID, SupportType } from '../_Matter.types.ts'

export const SOLID_DEF = {
  id: SOLID,
  name: 'Solid',
  // has small chance of lava hard coded
  lavaImmune: true as const,
  immutableSupport: SupportType.STRUCTURAL as const,
  structuralCollapseType: SAND,
} satisfies MatterDef

export default SOLID_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [SOLID]: typeof SOLID_DEF;
  }
}
