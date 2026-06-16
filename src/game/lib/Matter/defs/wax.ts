import { FALLING_WAX, FIRE, type MatterDef, SupportType, WAX } from '../_Matter.types.ts'

export const WAX_DEF = {
  id: WAX,
  name: 'Wax',
  immutableSupport: SupportType.STRUCTURAL as const,
  structuralCollapseType: FALLING_WAX,
  action(sim, tx, ty, idx): void {
    // Melt to falling wax near fire
    if (sim.borderingAdjacent(tx, ty, idx, FIRE) !== -1) {
      sim.tiles[idx] = FALLING_WAX
      sim.markDirty(tx, ty)
      sim.next.add(idx)
    }
  },
} satisfies MatterDef

export default WAX_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [WAX]: typeof WAX_DEF;
  }
}
