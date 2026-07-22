import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { FILL_MAX } from '../_Liquid.constants.ts'
import {
  EMPTY,
  FIRE,
  getCounter,
  getOwner,
  LAVA,
  type MatterDef,
  matterType,
  OIL,
  ROCK,
  SALT_WATER,
  setCounter,
  setOwner,
  setSettled,
  SOLID,
  STEAM,
  WATER,
} from '../_Matter.types.ts'
import { MatterTypeSet } from '../data/MatterTypeSet'
import { isLavaImmune } from '../matter.ts'

const COOLED = new MatterTypeSet(WATER, SALT_WATER)

// Ticks a partial-fill tile must stay isolated before it's destroyed — a
// same-tick chain reaction can make an actively-spreading edge briefly look
// isolated, so a fixed grace period (via the shared per-tile counter
// bitfield) avoids destroying live, still-connected lava.
const ISOLATED_DROPLET_GRACE_TICKS = 30

export const LAVA_DEF = {
  id: LAVA,
  name: 'Lava',
  lavaImmune: true as const,
  clumps: true as const,
  liquid: true as const,
  hasOwnerId: true as const,
  settles: true as const,
  reserveDestroyAmount: 1,
  action(sim, tx, ty, idx): void {
    const { tiles, fill, width, height } = sim

    const existing = tiles[idx]
    const ownerId = getOwner(existing)

    // Self-report as this column's eruption candidate — see MatterSim.lavaColumnTop.
    if (fill[idx] >= FILL_MAX && (ty === 0 || matterType(tiles[idx - width]) === EMPTY)) {
      sim.lavaColumnTop[tx] = ty
    }

    // Turn to rock when touching water or salt-water
    let waterLoc = sim.borderingAny(tx, ty, idx, COOLED)
    if (waterLoc !== -1) {
      // Water fill stays in the fill slot — STEAM carries it as conserved fill.
      tiles[waterLoc] = STEAM
      sim.consumeLiquidFill(idx)
      sim.notifySolidCreated()
      tiles[idx] = ROCK
      sim.markDirty(tx, ty)
      const wx = waterLoc % width
      const wy = waterLoc / width | 0
      // waterLoc becomes STEAM — non-collidable, render-only.
      sim.markRenderDirty(wx, wy)
      sim.next.add(waterLoc)
      sim.next.add(idx)
      return
    }

    // Spawn a lava burst particle and self-destruct when adjacent to oil
    if (sim.fill[idx] >= FILL_MAX && random() < 14 && sim.bordering(tx, ty, idx, OIL) !== -1) {
      sim.spawnParticle(ParticleType.LAVA_BURST, tx, ty, ownerId)
      sim.queueMatterCreditFromTile(tx, ty, idx)
      sim.destroyTile(tx, ty, idx)
      sim.reactivateAround(tx, ty)
      return
    }

    // Slowly melt adjacent SOLID (SOLID is lava immune otherwise)
    if (sim.fill[idx] >= FILL_MAX && random() < 1) {
      const meltLoc = sim.borderingAdjacent(tx, ty, idx, SOLID)
      if (meltLoc !== -1) {
        const mx = meltLoc % width
        const my = meltLoc / width | 0
        sim.queueMatterCredit(mx, my, ownerId)
        sim.destroyTile(mx, my, meltLoc)
        sim.reactivateAround(mx, my)
        // Single isolated SOLID neighbors → ROCK so they sink through the lava pool.
        // (The structural BFS converts disconnected islands to SAND, which doesn't sink.)
        const p1: [number, number, number][] = [
          [mx - 1, my, mx > 0 ? meltLoc - 1 : -1],
          [mx + 1, my, mx < width - 1 ? meltLoc + 1 : -1],
          [mx, my - 1, my > 0 ? meltLoc - width : -1],
          [mx, my + 1, my < height - 1 ? meltLoc + width : -1],
        ]
        for (const [nx, ny, nidx] of p1) {
          if (nidx === -1 || matterType(tiles[nidx]) !== SOLID) continue
          let n = 0
          if (nx > 0 && matterType(tiles[nidx - 1]) === SOLID) n++
          if (nx < width - 1 && matterType(tiles[nidx + 1]) === SOLID) n++
          if (ny > 0 && matterType(tiles[nidx - width]) === SOLID) n++
          if (ny < height - 1 && matterType(tiles[nidx + width]) === SOLID) n++
          if (n === 0) {
            tiles[nidx] = ROCK
            sim.markDirty(nx, ny)
            sim.next.add(nidx)
          }
        }
        sim.queueMatterCreditFromTile(tx, ty, idx)
        sim.destroyTile(tx, ty, idx)
        return
      }
    }

    // Lava-drop eruptions are triggered externally — see Coordinator.tryLavaEruption.
    const downIdx = ty < height - 1 ? idx + width : -1

    // Burn adjacent non-immune tiles (4-directional, SOLID is lava-immune so skipped)
    if (sim.fill[idx] >= FILL_MAX && random() < 25) {
      const burnCandidates: [number, number, number][] = [
        [tx, ty - 1, ty > 0 ? idx - width : -1],
        [tx, ty + 1, ty < height - 1 ? idx + width : -1],
        [tx - 1, ty, tx > 0 ? idx - 1 : -1],
        [tx + 1, ty, tx < width - 1 ? idx + 1 : -1],
      ]
      for (const [nx, ny, nidx] of burnCandidates) {
        if (nidx === -1) continue
        const nt = matterType(tiles[nidx])
        if (!isLavaImmune(nt)) {
          if (nt !== EMPTY) sim.queueMatterCredit(nx, ny, ownerId)
          sim.consumeLiquidFill(nidx)
          tiles[nidx] = setOwner(FIRE, ownerId)
          sim.queueMatterCredit(tx, ty, ownerId)
          sim.destroyTile(tx, ty, idx)
          sim.markDirty(nx, ny)
          sim.next.add(nidx)
          return
        }
      }
    }

    // Clear fire directly below so lava can fall through it
    if (downIdx !== -1) {
      const belowType = matterType(tiles[downIdx])
      if (belowType === FIRE) {
        tiles[downIdx] = EMPTY
        sim.markRenderDirty(tx, ty + 1)
        sim.reactivateAround(tx, ty + 1)
      } else if (belowType === STEAM && random() < 95) {
        // Lava sinks through steam — swap positions, preserving steam's conserved fill.
        // Not a destruction — the lava mass simply relocates to downIdx, still fully LAVA,
        // so its reservation must stay live rather than being released here.
        const steamFill = sim.fill[downIdx]
        sim.notifyLiquidCreated()
        sim.fill[downIdx] = FILL_MAX
        tiles[downIdx] = setOwner(LAVA, ownerId)
        sim.consumeLiquidFill(idx, false)
        sim.fill[idx] = steamFill
        tiles[idx] = STEAM
        sim.markRenderDirty(tx, ty)
        sim.markRenderDirty(tx, ty + 1)
        sim.next.add(downIdx)
        sim.next.add(idx)
        return
      }
    }

    // 15% chance to clear fire sideways so lava can flow horizontally through it
    if (random() < 15) {
      const leftIdx = tx > 0 ? idx - 1 : -1
      const rightIdx = tx < width - 1 ? idx + 1 : -1
      if (leftIdx !== -1 && matterType(tiles[leftIdx]) === FIRE) {
        tiles[leftIdx] = EMPTY
        sim.markRenderDirty(tx - 1, ty)
        sim.reactivateAround(tx - 1, ty)
      }
      if (rightIdx !== -1 && matterType(tiles[rightIdx]) === FIRE) {
        tiles[rightIdx] = EMPTY
        sim.markRenderDirty(tx + 1, ty)
        sim.reactivateAround(tx + 1, ty)
      }
    }

    const moved = sim.tryFillFlow(tx, ty, idx)
    if (matterType(tiles[idx]) === EMPTY) return  // tryFillFlow donated all fill and destroyed tile

    if (moved) {
      sim.reactivateAround(tx, ty)
    } else {
      if (fill[idx] < FILL_MAX) {
        const hasLivingNeighbour =
          (tx > 0 && matterType(tiles[idx - 1]) === LAVA && fill[idx - 1] > 0) ||
          (tx < width - 1 && matterType(tiles[idx + 1]) === LAVA && fill[idx + 1] > 0) ||
          (ty > 0 && matterType(tiles[idx - width]) === LAVA && fill[idx - width] > 0) ||
          (ty < height - 1 && matterType(tiles[idx + width]) === LAVA && fill[idx + width] > 0)
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
      if (sim.hasReachableDrainFromCell(tx, ty, LAVA)) {
        sim.next.add(idx)
      }
    }
  },
} satisfies MatterDef

export default LAVA_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [LAVA]: typeof LAVA_DEF;
  }
}
