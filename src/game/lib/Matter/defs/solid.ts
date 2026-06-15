import { type MatterDef, SAND, SOLID } from '../_Matter.types.ts'
import { registerMatterType } from '../matter.ts'

export const SOLID_DEF = {
  name: 'Solid',
  passive: true,
  // has small chance of lava hard coded
  lavaImmune: true,
  alwaysStructural: true,
  structuralCollapseType: SAND,
} satisfies MatterDef

registerMatterType(SOLID, SOLID_DEF)

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [SOLID]: typeof SOLID_DEF;
  }
}
