import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { FILL_MAX } from '../_Liquid.constants.ts'
import {
  EMPTY, FIRE,
  getOwner,
  LAVA,
  LAVA_DROP,
  type MatterDef,
  matterType,
  OIL,
  ROCK,
  SALT_WATER,
  setLavaDropVel,
  setOwner,
  setSettled,
  SOLID,
  STEAM,
  WATER,
} from '../_Matter.types.ts'
import { MatterTypeSet } from '../data/MatterTypeSet'
import { isLavaImmune } from '../matter.ts'

const IS_SETTLED = new MatterTypeSet(LAVA, EMPTY)
const COOLED = new MatterTypeSet(WATER, SALT_WATER)

export const LAVA_DROP_INITIAL_VEL = 10

export const LAVA_DEF = {
  id: LAVA,
  name: 'Lava',
  lavaImmune: true as const,
  liquid: true as const,
  hasOwnerId: true as const,
  settles: true as const,
  reserveDestroyAmount: 1,
  action(sim, tx, ty, idx): void {
    const { tiles, width, height } = sim
    const existing = tiles[idx]
    const ownerId = getOwner(existing)

    // Turn to rock when touching water or salt-water
    let waterLoc = sim.borderingAny(tx, ty, idx, COOLED)
    if (waterLoc !== -1) {
      sim.queueReservationRelease(ownerId, 1)
      sim.fill[waterLoc] = 0
      tiles[waterLoc] = STEAM
      sim.fill[idx] = 0
      tiles[idx] = ROCK
      sim.markDirty(tx, ty)
      const wx = waterLoc % width
      const wy = waterLoc / width | 0
      sim.markDirty(wx, wy)
      sim.next.add(waterLoc)
      sim.next.add(idx)
      return
    }

    // Spawn a lava burst particle and self-destruct when adjacent to oil
    if (random() < 14 && sim.bordering(tx, ty, idx, OIL) !== -1) {
      sim.spawnParticle(ParticleType.LAVA_BURST, tx, ty, ownerId)
      sim.queueMatterCreditFromTile(tx, ty, idx)
      sim.destroyTile(tx, ty, idx)
      sim.reactivateAround(tx, ty)
      return
    }

    // Slowly melt adjacent SOLID (SOLID is lava immune otherwise)
    if (random() < 1) {
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

    // Launch a lava drop upward — converts this lava tile into a projectile
    const upIdx = ty > 0 ? idx - width : -1
    const canMoveUp = upIdx !== -1
    if (
      canMoveUp &&
      random() < 6 &&
      matterType(tiles[upIdx]) === EMPTY &&
      sim.bordering(tx, ty, idx, LAVA)
    ) {
      sim.fill[idx] = 0
      tiles[idx] = setLavaDropVel(setOwner(LAVA_DROP, ownerId), LAVA_DROP_INITIAL_VEL)
      sim.markDirty(tx, ty)
      sim.next.add(idx)
      return
    }

    // Burn adjacent non-immune tiles (4-directional, SOLID is lava-immune so skipped)
    if (random() < 25) {
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
    const downIdx = ty < height - 1 ? idx + width : -1
    if (downIdx !== -1) {
      const belowType = matterType(tiles[downIdx])
      if (belowType === FIRE) {
        tiles[downIdx] = EMPTY
        sim.markDirty(tx, ty + 1)
        sim.reactivateAround(tx, ty + 1)
      } else if (belowType === STEAM && random() < 95) {
        // Lava sinks through steam — swap positions
        sim.fill[downIdx] = FILL_MAX
        tiles[downIdx] = setOwner(LAVA, ownerId)
        sim.fill[idx] = 0
        tiles[idx] = STEAM
        sim.markDirty(tx, ty)
        sim.markDirty(tx, ty + 1)
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
        sim.markDirty(tx - 1, ty)
        sim.reactivateAround(tx - 1, ty)
      }
      if (rightIdx !== -1 && matterType(tiles[rightIdx]) === FIRE) {
        tiles[rightIdx] = EMPTY
        sim.markDirty(tx + 1, ty)
        sim.reactivateAround(tx + 1, ty)
      }
    }

    const moved = sim.tryFillFlow(tx, ty, idx)

    if (moved) {
      sim.reactivateAround(tx, ty)

    } else {
      sim.tiles[idx] = setSettled(existing, true)
      sim.markDirty(tx, ty)

      if (!sim.surroundedByAny(tx, ty, idx, IS_SETTLED)) {
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
