import { random } from '../../../helpers/random'
import {
  C4, type MatterDef,
  EMPTY,
  FALLING_WAX,
  FIRE,
  FUSE,
  GUNPOWDER,
  matterType,
  NAPALM,
  NITRO,
  OIL,
  PLANT,
  SALT_WATER,
  STEAM,
  THERMITE,
  WATER,
  WAX,
} from '../_Matter-types.ts'

export const FIRE_DEF: MatterDef = {
  name: 'Fire',
  action(world, tx, ty, idx, next): void {
    const { tiles, width, height } = world

    // Wake settled defs that react to fire but won't self-activate
    world.wakeSettledNeighbors(tx, ty, idx, GUNPOWDER, next)
    world.wakeSettledNeighbors(tx, ty, idx, NAPALM, next)
    world.wakeSettledNeighbors(tx, ty, idx, NITRO, next)
    world.wakeSettledNeighbors(tx, ty, idx, THERMITE, next)

    // Extinguished by water / salt-water
    if (random() < 80) {
      let waterLoc = world.bordering(tx, ty, idx, WATER)
      if (waterLoc === -1) waterLoc = world.bordering(tx, ty, idx, SALT_WATER)
      if (waterLoc !== -1) {
        tiles[waterLoc] = STEAM
        tiles[idx] = EMPTY
        world.markDirty(tx, ty)
        const wx = waterLoc % width
        const wy = waterLoc / width | 0
        world.markDirty(wx, wy)
        next.add(waterLoc)
        return
      }
    }

    // Ignite plant
    if (random() < 20) {
      const plantLoc = world.borderingAdjacent(tx, ty, idx, PLANT)
      if (plantLoc !== -1) {
        tiles[plantLoc] = FIRE
        const px = plantLoc % width
        const py = plantLoc / width | 0
        world.markDirty(px, py)
        next.add(plantLoc)
        next.add(idx)
        return
      }
    }

    // Ignite fuse
    if (random() < 80) {
      const fuseLoc = world.borderingAdjacent(tx, ty, idx, FUSE)
      if (fuseLoc !== -1) {
        tiles[fuseLoc] = FIRE
        const fx = fuseLoc % width
        const fy = fuseLoc / width | 0
        world.markDirty(fx, fy)
        next.add(fuseLoc)
        next.add(idx)
        return
      }
    }

    // Ignite oil
    if (random() < 30) {
      const oilLoc = world.bordering(tx, ty, idx, OIL)
      if (oilLoc !== -1) {
        tiles[oilLoc] = FIRE
        const ox = oilLoc % width
        const oy = oilLoc / width | 0
        world.markDirty(ox, oy)
        next.add(oilLoc)
        next.add(idx)
        return
      }
    }

    // Melt wax → falling wax (passive, so fire must handle it directly)
    if (random() < 30) {
      const waxLoc = world.borderingAdjacent(tx, ty, idx, WAX)
      if (waxLoc !== -1) {
        tiles[waxLoc] = FALLING_WAX
        const wx = waxLoc % width
        const wy = waxLoc / width | 0
        world.markDirty(wx, wy)
        next.add(waxLoc)
        next.add(idx)
      }
    }

    // Wake C4 — adds it to next so its own explosion action runs (passive, can't self-wake)
    if (random() < 80) {
      const c4Loc = world.borderingAdjacent(tx, ty, idx, C4)
      if (c4Loc !== -1) {
        next.add(c4Loc)
        next.add(idx)
      }
    }

    // Probabilistic self-extinguish
    if (random() < 40) {
      const xStart = Math.max(tx - 1, 0)
      const yStart = Math.max(ty - 1, 0)
      const xEnd = Math.min(tx + 2, width)
      const yEnd = Math.min(ty + 2, height)
      let flameOut = true

      outer: for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
          if (y === ty && x === tx) continue
          const t = tiles[y * width + x]
          const bt = matterType(t)
          if (bt === FIRE) continue
          if (bt === PLANT || bt === FUSE || bt === OIL || bt === WAX) {
            flameOut = false
            break outer
          }
        }
      }

      if (flameOut) {
        tiles[idx] = EMPTY
        world.markDirty(tx, ty)
        world.reactivateAround(tx, ty, next)
        return
      }
    }

    // Rise upward
    if (random() < 50) {
      if (world.tryRise(idx, tx, ty, next)) return
    }

    next.add(idx)
  },
}