import { type MatterDef, FALLING_WAX, FIRE } from '../_Matter.types.ts'

export const WAX_DEF: MatterDef = {
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
}
