import {
  EMPTY,
  FIRE,
  FUSE,
  FUSE_BURN_TICKS,
  getCounter,
  getFirstOwnerId,
  getOwner,
  hasCounter,
  type MatterDef,
  setCounter,
  setOwner,
  SupportType,
} from '../_Matter.types.ts'

export const FUSE_DEF = {
  id: FUSE,
  name: 'Fuse',
  immutableSupport: SupportType.AFFIXED as const,
  hasOwnerId: true as const,
  action(sim, tx, ty, idx): void {
    const { tiles, width } = sim

    if (hasCounter(tiles[idx])) {
      const counter = getCounter(tiles[idx])
      const ownerId = getOwner(tiles[idx])

      const emptyLoc = sim.borderingAdjacent(tx, ty, idx, EMPTY)
      if (emptyLoc !== -1) {
        tiles[emptyLoc] = setOwner(FIRE, ownerId)
        sim.markDirty(emptyLoc % width, emptyLoc / width | 0)
        sim.next.add(emptyLoc)
      }

      if (counter <= 1) {
        sim.queueMatterCredit(tx, ty, ownerId)
        tiles[idx] = EMPTY
        sim.markDirty(tx, ty)
        sim.reactivateAround(tx, ty)
      } else {
        tiles[idx] = setCounter(tiles[idx], counter - 1)
        sim.markDirty(tx, ty)
        sim.next.add(idx)
      }
      return
    }

    // Ignite when touching fire — enter burn phase; credit deferred to burn-complete
    const nidx = sim.bordering(tx, ty, idx, FIRE)
    if (nidx !== -1) {
      const ownerId = getFirstOwnerId(tiles[nidx], tiles[idx])
      tiles[idx] = setCounter(setOwner(tiles[idx], ownerId), FUSE_BURN_TICKS)
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
