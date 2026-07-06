import { FILL_MAX } from '../_Liquid.constants.ts'
import {
  EMPTY,
  FIRE,
  getLavaDropVel,
  getOwner,
  LAVA,
  LAVA_DROP,
  type MatterDef,
  matterType,
  setLavaDropVel,
  setOwner,
} from '../_Matter.types.ts'
import { isLavaImmune } from '../matter.ts'

export const LAVA_DROP_DEF = {
  id: LAVA_DROP,
  name: 'Lava Drop',
  lavaImmune: true as const,
  hasOwnerId: true as const,
  alwaysActive: true as const,
  collidesWithCreateProjectiles: false as const,
  reserveDestroyAmount: 1,
  action(sim, tx, ty, idx): void {
    const { tiles, width, height } = sim
    const existing = tiles[idx]
    const ownerId = getOwner(existing)
    const vel = getLavaDropVel(existing)

    if (vel > 0) {
      const upIdx = ty > 0 ? idx - width : -1

      if (upIdx !== -1) {
        const aboveType = matterType(tiles[upIdx])

        if (aboveType === EMPTY || aboveType === FIRE) {
          // Move up (overwrites fire if present), decrement velocity
          tiles[upIdx] = setLavaDropVel(existing, vel - 1)
          tiles[idx] = EMPTY
          sim.markDirty(tx, ty)
          sim.markDirty(tx, ty - 1)
          sim.next.add(upIdx)
          sim.reactivateAround(tx, ty)
          return
        }

        // Blocked going up: burn non-immune tile (aboveType is neither EMPTY nor FIRE here —
        // both already returned above)
        if (!isLavaImmune(aboveType)) {
          sim.queueMatterCredit(tx, ty - 1, ownerId)
          sim.consumeLiquidFill(upIdx)
          tiles[upIdx] = setOwner(FIRE, ownerId)
          sim.markDirty(tx, ty - 1)
          sim.next.add(upIdx)
        }
      }

      // Hit ceiling or blocked: zero velocity and start falling next tick
      tiles[idx] = setLavaDropVel(existing, 0)
      sim.markDirty(tx, ty)
      sim.next.add(idx)
      return
    }

    // Falling phase (vel == 0)
    const downIdx = ty < height - 1 ? idx + width : -1

    if (downIdx !== -1) {
      const belowType = matterType(tiles[downIdx])

      if (belowType === EMPTY || belowType === FIRE) {
        tiles[downIdx] = existing
        tiles[idx] = EMPTY
        sim.markDirty(tx, ty)
        sim.markDirty(tx, ty + 1)
        sim.next.add(downIdx)
        sim.reactivateAround(tx, ty)
        return
      }

      if (belowType === LAVA) {
        // Fell directly onto lava: merge into the pool
        sim.notifySolidConsumed()
        sim.notifyLiquidCreated()
        sim.fill[idx] = FILL_MAX
        tiles[idx] = setOwner(LAVA, ownerId)
        sim.markDirty(tx, ty)
        sim.next.add(idx)
        return
      }
    }

    // Landed: burn all non-immune neighbors (fire contact effect)
    const neighbors: [number, number, number][] = [
      [tx, ty - 1, ty > 0 ? idx - width : -1],
      [tx, ty + 1, ty < height - 1 ? idx + width : -1],
      [tx - 1, ty, tx > 0 ? idx - 1 : -1],
      [tx + 1, ty, tx < width - 1 ? idx + 1 : -1],
    ]
    for (const [nx, ny, nidx] of neighbors) {
      if (nidx === -1) continue
      const nt = matterType(tiles[nidx])
      if (nt !== EMPTY && !isLavaImmune(nt)) {
        sim.queueMatterCredit(nx, ny, ownerId)
        sim.consumeLiquidFill(nidx)
        tiles[nidx] = setOwner(FIRE, ownerId)
        sim.markDirty(nx, ny)
        sim.next.add(nidx)
      }
    }

    // Settle as lava
    sim.notifySolidConsumed()
    sim.notifyLiquidCreated()
    sim.fill[idx] = FILL_MAX
    tiles[idx] = setOwner(LAVA, ownerId)
    sim.next.add(idx)
    sim.markDirty(tx, ty)
    sim.reactivateAround(tx, ty)
  },
} satisfies MatterDef

export default LAVA_DROP_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [LAVA_DROP]: typeof LAVA_DROP_DEF;
  }
}
