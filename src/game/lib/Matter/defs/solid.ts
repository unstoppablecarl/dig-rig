import { type MatterDef, SAND, SOLID } from '../_Matter.types.ts'

export const SOLID_DEF = {
  id: SOLID,
  name: 'Solid',
  passive: true as const,
  // has small chance of lava hard coded
  lavaImmune: true as const,
  alwaysStructural: true as const,
  structuralCollapseType: SAND,
} satisfies MatterDef

export default SOLID_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [SOLID]: typeof SOLID_DEF;
  }
}
