import { random } from '../../../helpers/random'
import {
  ACID,
  EMPTY,
  getOwner,
  type MatterDef,
  matterType,
  SALT_WATER,
  setSettled,
  SOLID,
  WATER,
} from '../_Matter.types.ts'
import { MatterTypeSet } from '../data/MatterTypeSet'
import { isAcidImmune } from '../matter.ts'

const IS_SETTLED = new MatterTypeSet(ACID, EMPTY)

export const ACID_DEF = {
  id: ACID,
  name: 'Acid',
  liquid: true as const,
  acidImmune: true as const,
  hasOwnerId: true as const,
  settles: true as const,
  reserveDestroyAmount: 2,
  action(sim, tx, ty, idx): void {
    const { tiles, width, height } = sim
    const leftFirst = sim.leftFirst

    // Dissolve a bordering tile
    if (random() < 10) {
      const leftNeighbor = [tx - 1, ty, idx - 1]
      const rightNeighbor = [tx + 1, ty, idx + 1]

      const neighbors = [
        leftFirst ? leftNeighbor : rightNeighbor,
        leftFirst ? rightNeighbor : leftNeighbor,
        [tx, ty + 1, idx + width],
        [tx, ty - 1, idx - width],
      ] as [number, number, number][]

      for (const [nx, ny, nidx] of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue

        const nt = matterType(tiles[nidx])
        if (isAcidImmune(nt)) continue

        const ownerId = getOwner(tiles[idx])
        sim.queueMatterCredit(tx, ty, ownerId)
        sim.destroyTile(tx, ty, idx)

        sim.queueMatterCredit(nx, ny, ownerId)
        sim.destroyTile(nx, ny, nidx)
        return
      }
    }

    // Acid is denser than water and salt-water — sink through them
    if (sim.doDensityLiquid(tx, ty, idx, WATER, 25, 30)) return
    if (sim.doDensityLiquid(tx, ty, idx, SALT_WATER, 25, 30)) return
    if (sim.hasDensityBelow(tx, ty, WATER) || sim.hasDensityBelow(tx, ty, SALT_WATER)) {
      sim.next.add(idx)
      return
    }

    // stickiness
    const touchingSolid = sim.bordering(tx, ty, idx, SOLID) !== -1
    if (touchingSolid && random() < 95) {
      sim.next.add(idx)
      return
    }

    const moved = sim.tryFillFlow(tx, ty, idx)
    if (!moved) {
      sim.tiles[idx] = setSettled(sim.tiles[idx], true)
      sim.markDirty(tx, ty)

      if (!sim.surroundedByAny(tx, ty, idx, IS_SETTLED)) {
        sim.next.add(idx)
      }
    }
  },
} satisfies MatterDef

export default ACID_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [ACID]: typeof ACID_DEF;
  }
}