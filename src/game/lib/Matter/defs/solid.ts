import { type MatterDef, SAND, SOLID } from '../_Matter.types.ts'

export const SOLID_DEF = {
  id: SOLID,
  name: 'Solid',
  passive: true,
  // has small chance of lava hard coded
  lavaImmune: true,
  alwaysStructural: true,
  structuralCollapseType: SAND,
} satisfies MatterDef

export default SOLID_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [SOLID]: typeof SOLID_DEF;
  }
}
