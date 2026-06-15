import { random } from '../../../helpers/random'
import {
  C4,
  EMPTY,
  FALLING_WAX,
  FIRE,
  FUSE,
  GUNPOWDER,
  type MatterDef,
  matterType,
  NAPALM,
  NITRO,
  OIL,
  PLANT,
  SALT_WATER,
  THERMITE,
  WATER,
  WAX,
} from '../_Matter.types.ts'
import { MatterTypeSet } from '../data/MatterTypeSet'
import { registerMatterType } from '../matter.ts'

const KEEP_ALIVE = new MatterTypeSet(PLANT, FUSE, OIL, WAX)
const WATER_OR_SALT_WATER = new MatterTypeSet(WATER, SALT_WATER)

// fire does not represent solid matter so does not follow the preserving matter rule
export const FIRE_DEF = {
  name: 'Fire',
  action(world, tx, ty, idx): void {
    const { tiles, width, height } = world

    // Wake settled defs that react to fire but won't self-activate
    world.wakeSettledNeighbors(tx, ty, idx, GUNPOWDER)
    world.wakeSettledNeighbors(tx, ty, idx, NAPALM)
    world.wakeSettledNeighbors(tx, ty, idx, NITRO)
    world.wakeSettledNeighbors(tx, ty, idx, THERMITE)

    const existing = tiles[idx]

    // Extinguished by water / salt-water
    if (random() < 80) {
      let waterLoc = world.borderingAny(tx, ty, idx, WATER_OR_SALT_WATER)
      if (waterLoc !== -1) {
        // move water to matter tank
        world.queueMatterCreditFromTile(tx, ty, idx)
        tiles[waterLoc] = EMPTY
        // fire never has matter to return
        tiles[idx] = EMPTY
        world.markDirty(tx, ty)
        world.reactivateAround(tx, ty)
        const wx = waterLoc % width
        const wy = waterLoc / width | 0
        world.markDirty(wx, wy)
        world.next.add(waterLoc)
        return
      }
    }

    // Ignite plant
    if (random() < 20) {
      const plantLoc = world.borderingAdjacent(tx, ty, idx, PLANT)
      if (plantLoc !== -1) {
        tiles[plantLoc] = existing
        const px = plantLoc % width
        const py = plantLoc / width | 0
        world.queueMatterCreditFromTile(px, py, plantLoc)
        world.markDirty(px, py)
        world.next.add(plantLoc)
        world.next.add(idx)
        return
      }
    }

    // Ignite fuse
    if (random() < 80) {
      const fuseLoc = world.borderingAdjacent(tx, ty, idx, FUSE)
      if (fuseLoc !== -1) {
        world.queueMatterCreditFromTile(tx, ty, idx)
        tiles[fuseLoc] = existing
        const fx = fuseLoc % width
        const fy = fuseLoc / width | 0
        world.markDirty(fx, fy)
        world.next.add(fuseLoc)
        world.next.add(idx)
        return
      }
    }

    // Ignite oil
    if (random() < 30) {
      const oilLoc = world.bordering(tx, ty, idx, OIL)
      if (oilLoc !== -1) {
        world.queueMatterCreditFromTile(tx, ty, idx)
        tiles[oilLoc] = existing
        const ox = oilLoc % width
        const oy = oilLoc / width | 0
        world.markDirty(ox, oy)
        world.next.add(oilLoc)
        world.next.add(idx)
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
        world.next.add(waxLoc)
        world.next.add(idx)
      }
    }

    // Wake C4 — adds it to next so its own explosion action runs (passive, can't self-wake)
    if (random() < 80) {
      const c4Loc = world.borderingAdjacent(tx, ty, idx, C4)
      if (c4Loc !== -1) {
        world.next.add(c4Loc)
        world.next.add(idx)
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
          const bt = matterType(tiles[y * width + x])
          if (bt === FIRE) continue
          if (KEEP_ALIVE.has(bt)) {
            flameOut = false
            break outer
          }
        }
      }

      if (flameOut) {
        // fire never has matter to return
        tiles[idx] = EMPTY
        world.markDirty(tx, ty)
        world.reactivateAround(tx, ty)
        return
      }
    }

    // Rise upward
    if (random() < 50) {
      if (world.tryRise(idx, tx, ty)) return
    }

    world.next.add(idx)
  },
} satisfies MatterDef

registerMatterType(FIRE, FIRE_DEF)

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [FIRE]: typeof FIRE_DEF;
  }
}