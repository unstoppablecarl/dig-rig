import { random } from '../../../helpers/random'
import {
  EMPTY,
  FIRE,
  getCounter,
  getFirstOwnerId,
  getOwner,
  hasCounter,
  type MatterDef,
  OIL,
  OIL_BURN_TICKS,
  setCounter,
  setOwner,
  setSettled,
} from '../_Matter.types.ts'

export const OIL_DEF = {
  id: OIL,
  name: 'Oil',
  liquid: true as const,
  hasOwnerId: true as const,
  settles: true as const,
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

      // Spread burn to an adjacent oil tile that has an empty neighbour (surface oil only).
      const neighborOilLoc = sim.bordering(tx, ty, idx, OIL)
      if (neighborOilLoc !== -1 && !hasCounter(tiles[neighborOilLoc])) {
        const nx = neighborOilLoc % width
        const ny = neighborOilLoc / width | 0
        if (sim.bordering(nx, ny, neighborOilLoc, EMPTY) !== -1) {
          tiles[neighborOilLoc] = setCounter(setOwner(tiles[neighborOilLoc], ownerId), OIL_BURN_TICKS)
          sim.markDirty(nx, ny)
          sim.next.add(neighborOilLoc)
        }
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

    if (random() < 30) {
      const nidx = sim.borderingAdjacent(tx, ty, idx, FIRE)
      if (nidx !== -1) {
        const ownerId = getFirstOwnerId(tiles[nidx], tiles[idx])
        tiles[idx] = setCounter(setOwner(tiles[idx], ownerId), OIL_BURN_TICKS)
        sim.markDirty(tx, ty)
        sim.next.add(idx)
        return
      }
    }

    const moved = sim.tryLiquidFlow(tx, ty, idx)
    if (!moved) {
      tiles[idx] = setSettled(OIL, true)
      sim.markDirty(tx, ty)
    }
  },
} satisfies MatterDef

export default OIL_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [OIL]: typeof OIL_DEF;
  }
}
