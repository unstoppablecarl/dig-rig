import { FIRE, FUSE, getFirstOwnerId, type MatterDef, setOwner } from '../_Matter.types.ts'
import { registerMatterType } from '../matter.ts'

export const FUSE_DEF = {
  name: 'Fuse',
  passive: true,
  action(world, tx, ty, idx): void {
    const { tiles } = world
    // Ignite when touching fire — convert self to fire and propagate
    const nidx = world.bordering(tx, ty, idx, FIRE)
    if (nidx !== -1) {
      // fuse owner or fallback to fire owner
      const ownerId = getFirstOwnerId(tiles[idx], tiles[nidx])

      tiles[idx] = setOwner(FIRE, ownerId)
      world.markDirty(tx, ty)
      world.next.add(idx)
    }
  },
} satisfies MatterDef

registerMatterType(FUSE, FUSE_DEF)

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [FUSE]: typeof FUSE_DEF;
  }
}
