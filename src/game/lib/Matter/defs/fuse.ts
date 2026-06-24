import { FIRE, FUSE, getFirstOwnerId, type MatterDef, setOwner, SupportType } from '../_Matter.types.ts'

export const FUSE_DEF = {
  id: FUSE,
  name: 'Fuse',
  immutableSupport: SupportType.AFFIXED as const,
  hasOwnerId: true as const,
  action(sim, tx, ty, idx): void {
    const { tiles } = sim
    // Ignite when touching fire — convert self to fire and propagate
    const nidx = sim.bordering(tx, ty, idx, FIRE)
    if (nidx !== -1) {
      // fuse owner or fallback to fire owner
      const ownerId = getFirstOwnerId(tiles[idx], tiles[nidx])

      sim.queueMatterCredit(tx, ty, ownerId)
      tiles[idx] = setOwner(FIRE, ownerId)
      sim.markDirty(tx, ty)
      sim.next.add(idx)
    }
  },
} satisfies MatterDef

export default FUSE_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [FUSE]: typeof FUSE_DEF;
  }
}
