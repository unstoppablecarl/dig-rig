import { random } from '../../../helpers/random'
import { FILL_MAX } from '../_Liquid.constants.ts'
import {
  ACID,
  EMPTY,
  getCounter,
  getOwner,
  type MatterDef,
  matterType,
  SALT_WATER,
  setCounter,
  setSettled,
  WATER,
} from '../_Matter.types.ts'
import { isAcidImmune } from '../matter.ts'

// Ticks a partial-fill tile must stay isolated before it's destroyed — a
// same-tick chain reaction can make an actively-spreading edge briefly look
// isolated, so a fixed grace period (via the shared per-tile counter
// bitfield) avoids destroying live, still-connected acid.
const ISOLATED_DROPLET_GRACE_TICKS = 30

export const ACID_DEF = {
  id: ACID,
  name: 'Acid',
  liquid: true as const,
  acidImmune: true as const,
  clumps: true as const,
  hasOwnerId: true as const,
  settles: true as const,
  reserveDestroyAmount: 2,
  action(sim, tx, ty, idx): void {
    const { tiles, fill, width, height } = sim
    const leftFirst = sim.leftFirst

    // Dissolve a bordering tile
    if (random() < 10 && fill[idx] >= FILL_MAX) {
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

    const moved = sim.tryFillFlow(tx, ty, idx)
    if (matterType(tiles[idx]) === EMPTY) return  // tryFillFlow donated all fill and destroyed tile

    if (moved) {
      sim.reactivateAround(tx, ty)
    } else {
      if (fill[idx] < FILL_MAX) {
        const hasLivingNeighbour =
          (tx > 0 && matterType(tiles[idx - 1]) === ACID && fill[idx - 1] > 0) ||
          (tx < width - 1 && matterType(tiles[idx + 1]) === ACID && fill[idx + 1] > 0) ||
          (ty > 0 && matterType(tiles[idx - width]) === ACID && fill[idx - width] > 0) ||
          (ty < height - 1 && matterType(tiles[idx + width]) === ACID && fill[idx + width] > 0)
        if (hasLivingNeighbour) {
          if (getCounter(tiles[idx]) !== 0) sim.tiles[idx] = setCounter(tiles[idx], 0)
        } else {
          const isolatedTicks = getCounter(tiles[idx]) + 1
          if (isolatedTicks >= ISOLATED_DROPLET_GRACE_TICKS) {
            sim.queueMatterCreditFromTile(tx, ty, idx)
            sim.destroyTile(tx, ty, idx)
            sim.reactivateAround(tx, ty)
            return
          }
          sim.tiles[idx] = setCounter(tiles[idx], isolatedTicks)
          sim.next.add(idx)
        }
      }
      sim.tiles[idx] = setSettled(sim.tiles[idx], true)
      sim.markRenderDirty(tx, ty)

      // Keep re-checking only while this cell's run has an actual reachable
      // drain — see water.ts for why.
      if (sim.hasReachableDrainFromCell(tx, ty, ACID)) {
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