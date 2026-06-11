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
} from '../_Matter-types.ts'

export const CRYO_DEF: MatterDef = {
  name: 'Cryo',
  acidImmune: true,
  action(world, tx, ty, idx): void {
    const { tiles, width } = world
    // Lava contact: cryo evaporates, lava solidifies
    const lavaLoc = world.bordering(tx, ty, idx, LAVA)
    if (lavaLoc !== -1) {
      const ownerId = getFirstOwnerId(tiles[idx], tiles[lavaLoc])
      world.queueMatterCredit(tx, ty, ownerId)
      tiles[idx] = EMPTY
      tiles[lavaLoc] = ROCK
      world.markDirty(tx, ty)
      const lx = lavaLoc % width
      const ly = lavaLoc / width | 0
      world.markDirty(lx, ly)
      world.reactivateAround(tx, ty)
      return
    }

    // Freeze adjacent ice → CHILLED_ICE (cryo stays alive)
    if (random() < 50) {
      const iceLoc = world.bordering(tx, ty, idx, ICE)
      if (iceLoc !== -1) {
        tiles[iceLoc] = CHILLED_ICE
        const ix = iceLoc % width
        const iy = iceLoc / width | 0
        world.markDirty(ix, iy)
        world.next.add(iceLoc)
      }
    }

    // Density sink: cryo is denser than water/salt-water/oil — displaced water freezes
    if (world.doDensityLiquid(tx, ty, idx, WATER, 80, 40, CHILLED_ICE)) return
    if (world.doDensityLiquid(tx, ty, idx, SALT_WATER, 80, 40, CHILLED_ICE)) return
    if (world.doDensityLiquid(tx, ty, idx, OIL, 80, 40)) return
    if (world.hasDensityBelow(tx, ty, WATER) || world.hasDensityBelow(tx, ty, SALT_WATER) || world.hasDensityBelow(tx, ty, OIL)) {
      world.next.add(idx)
      return
    }

    const moved = world.tryLiquidFlow(tx, ty, idx)

    if (!moved) {
      // Freeze an adjacent water cell when immobile
      const waterLoc = world.borderingAdjacent(tx, ty, idx, WATER)
      if (waterLoc !== -1) {
        tiles[waterLoc] = CHILLED_ICE
        const wx = waterLoc % width
        const wy = waterLoc / width | 0
        world.markDirty(wx, wy)
        world.next.add(waterLoc)
        world.next.add(idx)
        return
      }

      // Slowly self-freeze when fully immobile and no water to interact with
      if (random() < 1 && random() < 50) {
        tiles[idx] = CHILLED_ICE
        world.markDirty(tx, ty)
        world.reactivateAround(tx, ty)
        return
      }

      tiles[idx] = setSettled(CRYO, true)
      world.markDirty(tx, ty)
    }
  },
}
