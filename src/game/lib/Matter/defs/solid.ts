import { type MatterDef, SAND } from '../_Matter.types.ts'

export const SOLID_DEF: MatterDef = {
  name: 'Solid',
  passive: true,
  // has small chance of lava hard coded
  lavaImmune: true,
  alwaysStructural: true,
  structuralCollapseType: SAND,
}
