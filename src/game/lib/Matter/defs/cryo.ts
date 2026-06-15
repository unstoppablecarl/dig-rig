import { random } from '../../../helpers/random'
import {
  CHILLED_ICE,
  CRYO,
  EMPTY,
  getFirstOwnerId,
  ICE,
  LAVA,
  type MatterDef,
  OIL,
  ROCK,
  SALT_WATER,
  setSettled,
  WATER,
} from '../_Matter.types.ts'

export const CRYO_DEF = {
  id: CRYO,
  name: 'Cryo',
  acidImmune: true as const,
  hasOwnerId: true as const,
  action(sim, tx, ty, idx): void {
    const { tiles, width } = sim
    // Lava contact: cryo evaporates, lava solidifies
    const lavaLoc = sim.bordering(tx, ty, idx, LAVA)
    if (lavaLoc !== -1) {
      const ownerId = getFirstOwnerId(tiles[idx], tiles[lavaLoc])
      sim.queueMatterCredit(tx, ty, ownerId)
      tiles[idx] = EMPTY
      tiles[lavaLoc] = ROCK
      sim.markDirty(tx, ty)
      const lx = lavaLoc % width
      const ly = lavaLoc / width | 0
      sim.markDirty(lx, ly)
      sim.reactivateAround(tx, ty)
      return
    }

    // Freeze adjacent ice → CHILLED_ICE (cryo stays alive)
    if (random() < 50) {
      const iceLoc = sim.bordering(tx, ty, idx, ICE)
      if (iceLoc !== -1) {
        tiles[iceLoc] = CHILLED_ICE
        const ix = iceLoc % width
        const iy = iceLoc / width | 0
        sim.markDirty(ix, iy)
        sim.next.add(iceLoc)
      }
    }

    // Density sink: cryo is denser than water/salt-water/oil — displaced water freezes
    if (sim.doDensityLiquid(tx, ty, idx, WATER, 80, 40, CHILLED_ICE)) return
    if (sim.doDensityLiquid(tx, ty, idx, SALT_WATER, 80, 40, CHILLED_ICE)) return
    if (sim.doDensityLiquid(tx, ty, idx, OIL, 80, 40)) return
    if (sim.hasDensityBelow(tx, ty, WATER) || sim.hasDensityBelow(tx, ty, SALT_WATER) || sim.hasDensityBelow(tx, ty, OIL)) {
      sim.next.add(idx)
      return
    }

    const moved = sim.tryLiquidFlow(tx, ty, idx)

    if (!moved) {
      // Freeze an adjacent water cell when immobile
      const waterLoc = sim.borderingAdjacent(tx, ty, idx, WATER)
      if (waterLoc !== -1) {
        tiles[waterLoc] = CHILLED_ICE
        const wx = waterLoc % width
        const wy = waterLoc / width | 0
        sim.markDirty(wx, wy)
        sim.next.add(waterLoc)
        sim.next.add(idx)
        return
      }

      // Slowly self-freeze when fully immobile and no water to interact with
      if (random() < 1 && random() < 50) {
        tiles[idx] = CHILLED_ICE
        sim.markDirty(tx, ty)
        sim.reactivateAround(tx, ty)
        return
      }

      tiles[idx] = setSettled(CRYO, true)
      sim.markDirty(tx, ty)
    }
  },
} satisfies MatterDef

export default CRYO_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [CRYO]: typeof CRYO_DEF;
  }
}


