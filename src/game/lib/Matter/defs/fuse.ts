import { type MatterDef, FIRE } from '../_Matter-types.ts'

export const FUSE_DEF: MatterDef = {
  name: 'Fuse',
  passive: true,
  action(world, tx, ty, idx, next): void {
    // Ignite when touching fire — convert self to fire and propagate
    if (world.bordering(tx, ty, idx, FIRE) !== -1) {
      world.tiles[idx] = FIRE
      world.markDirty(tx, ty)
      next.add(idx)
    }
  },
}
