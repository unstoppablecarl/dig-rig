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
  SOLID,
  WATER,
} from '../_Matter.types.ts'
import { MatterTypeSet } from '../data/MatterTypeSet'
import { ACID_STICKS_TO, isAcidImmune, isLiquid } from '../matter.ts'

const IS_SETTLED = new MatterTypeSet(ACID, EMPTY)

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

      // @TODO if fill > FILL_MAX transfer excess to neighbor ACID or EMPTY

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

    // Stickiness — only when acid can actually dissolve (full tile).
    // Partial acid has nothing to react with; don't delay its movement.
    // Only stick when gravity can't act (below is not empty/passable); a wall to
    // the side or above must not prevent the tile from falling.
    const belowType = ty + 1 < height ? matterType(tiles[idx + width]) : SOLID
    const canFall = belowType === EMPTY || belowType === ACID
    const touchingSolid = !canFall && sim.borderingAny(tx, ty, idx, ACID_STICKS_TO) !== -1
    const onImmuneFloor = isAcidImmune(belowType) && !isLiquid(belowType)
    // Reused below for the stickiness gate and the clump-vs-spread decision —
    // an unbounded run walk, only paid for when actually resting on something.
    const hasDrainNearby = (touchingSolid || onImmuneFloor) && sim.hasReachableDrainFromCell(tx, ty, ACID)
    // Skip sticking when a drain is confirmed — otherwise relaying to an
    // edge across a wide floor can outlast DRAIN_WATCH_GRACE_TICKS and get
    // force-destroyed before stickiness ever lets it move.
    if (touchingSolid && fill[idx] >= FILL_MAX && random() < 95 && !hasDrainNearby) {
      sim.next.add(idx)
      return
    }

    // Spread toward a confirmed drain instead of clumping; clump once no
    // drain is reachable so isolated stragglers consolidate instead of
    // scattering across the floor.
    const canExpand = (onImmuneFloor && hasDrainNearby) || fill[idx] >= FILL_MAX
    const clump = !(onImmuneFloor && hasDrainNearby)

    const moved = sim.tryFillFlow(tx, ty, idx, canExpand, clump)
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