import { random } from '../../../helpers/random'
import { CHILLED_ICE, CRYO, EMPTY, ICE, LAVA, OIL, ROCK, SALT_WATER, setSettled, WATER } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: CRYO,
  name: 'Cryo',
  acidImmune: true,
  action(world, tx, ty, idx, next): void {
    // Lava contact: cryo evaporates, lava solidifies
    const lavaLoc = world.bordering(tx, ty, idx, LAVA)
    if (lavaLoc !== -1) {
      world.tiles[idx] = EMPTY
      world.tiles[lavaLoc] = ROCK
      world.markDirty(tx, ty)
      const lx = lavaLoc % world.width
      const ly = lavaLoc / world.width | 0
      world.markDirty(lx, ly)
      world.reactivateAround(tx, ty, next)
      return
    }

    // Freeze adjacent ice → CHILLED_ICE (cryo stays alive)
    if (random() < 50) {
      const iceLoc = world.bordering(tx, ty, idx, ICE)
      if (iceLoc !== -1) {
        world.tiles[iceLoc] = CHILLED_ICE
        const ix = iceLoc % world.width
        const iy = iceLoc / world.width | 0
        world.markDirty(ix, iy)
        next.add(iceLoc)
      }
    }

    // Density sink: cryo is denser than water/salt-water/oil — displaced water freezes
    if (world.doDensityLiquid(tx, ty, idx, next, WATER, 80, 40, CHILLED_ICE)) return
    if (world.doDensityLiquid(tx, ty, idx, next, SALT_WATER, 80, 40, CHILLED_ICE)) return
    if (world.doDensityLiquid(tx, ty, idx, next, OIL, 80, 40)) return
    if (world.hasDensityBelow(tx, ty, WATER) || world.hasDensityBelow(tx, ty, SALT_WATER) || world.hasDensityBelow(tx, ty, OIL)) {
      next.add(idx)
      return
    }

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx, ty + 1, CRYO, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, CRYO, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, CRYO, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1, next)

    if (!moved) {
      // Freeze an adjacent water cell when immobile
      const waterLoc = world.borderingAdjacent(tx, ty, idx, WATER)
      if (waterLoc !== -1) {
        world.tiles[waterLoc] = CHILLED_ICE
        const wx = waterLoc % world.width
        const wy = waterLoc / world.width | 0
        world.markDirty(wx, wy)
        next.add(waterLoc)
        next.add(idx)
        return
      }

      // Slowly self-freeze when fully immobile and no water to interact with
      if (random() < 1 && random() < 50) {
        world.tiles[idx] = CHILLED_ICE
        world.markDirty(tx, ty)
        world.reactivateAround(tx, ty, next)
        return
      }

      world.tiles[idx] = setSettled(CRYO, true)
      world.markDirty(tx, ty)
    }
  },
}

export default def
