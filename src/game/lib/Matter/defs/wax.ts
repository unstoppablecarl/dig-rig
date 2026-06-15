import { FALLING_WAX, FIRE, type MatterDef, WAX } from '../_Matter.types.ts'

export const WAX_DEF = {
  id: WAX,
  name: 'Wax',
  passive: true,
  alwaysStructural: true,
  structuralCollapseType: FALLING_WAX,
  action(world, tx, ty, idx): void {
    // Melt to falling wax near fire
    if (world.borderingAdjacent(tx, ty, idx, FIRE) !== -1) {
      world.tiles[idx] = FALLING_WAX
      world.markDirty(tx, ty)
      world.next.add(idx)
    }
  },
} satisfies MatterDef

export default WAX_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [WAX]: typeof WAX_DEF;
  }
}
