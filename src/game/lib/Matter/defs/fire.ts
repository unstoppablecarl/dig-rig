import { random } from '../../../helpers/random'
import {
  C4,
  EMPTY,
  FALLING_WAX,
  FIRE,
  FIRE_INIT_AGE,
  FUSE,
  getCounter,
  getOwner,
  GUNPOWDER,
  hasCounter,
  type MatterDef,
  matterType,
  NAPALM,
  NITRO,
  OIL,
  PLANT,
  PLANT_BURN_TICKS,
  SALT_WATER,
  setCounter,
  setOwner,
  STEAM,
  THERMITE,
  WATER,
  WAX,
} from '../_Matter.types.ts'
import { MatterTypeSet } from '../data/MatterTypeSet'

const WAKE_SETTLED = new MatterTypeSet(GUNPOWDER, NAPALM, NITRO, THERMITE, OIL)

// fire does not represent solid matter so does not follow the preserving matter rule
export const FIRE_DEF = {
  id: FIRE,
  name: 'Fire',
  hasOwnerId: true as const,
  alwaysActive: true as const,
  action(sim, tx, ty, idx): void {
    const { tiles, width, height } = sim

    let age = getCounter(tiles[idx])
    if (age === 0) {
      age = FIRE_INIT_AGE - (random() % 6)
      tiles[idx] = setCounter(tiles[idx], age)
    }

    sim.wakeSettledNeighborTypes(tx, ty, idx, WAKE_SETTLED)

    // Pre-scan all 8 neighbours once — reused by every check below.
    const atTop = ty === 0
    const atBot = ty === height - 1
    const b = atBot ? -1 : idx + width
    const a = atTop ? -1 : idx - width
    const l = tx > 0 ? idx - 1 : -1
    const r = tx < width - 1 ? idx + 1 : -1
    const bl = b >= 0 && l >= 0 ? b - 1 : -1
    const br = b >= 0 && r >= 0 ? b + 1 : -1
    const al = a >= 0 && l >= 0 ? a - 1 : -1
    const ar = a >= 0 && r >= 0 ? a + 1 : -1

    const tb = b >= 0 ? matterType(tiles[b]) : -1
    const ta = a >= 0 ? matterType(tiles[a]) : -1
    const tl = l >= 0 ? matterType(tiles[l]) : -1
    const tr = r >= 0 ? matterType(tiles[r]) : -1
    const tbl = bl >= 0 ? matterType(tiles[bl]) : -1
    const tbr = br >= 0 ? matterType(tiles[br]) : -1
    const tal = al >= 0 ? matterType(tiles[al]) : -1
    const tar = ar >= 0 ? matterType(tiles[ar]) : -1

    // Extinguish: water / salt-water (4-cardinal, matching borderingAny)
    if (random() < 80) {
      let waterLoc = -1
      if (tb === WATER || tb === SALT_WATER) waterLoc = b
      else if (tl === WATER || tl === SALT_WATER) waterLoc = l
      else if (tr === WATER || tr === SALT_WATER) waterLoc = r
      else if (ta === WATER || ta === SALT_WATER) waterLoc = a
      if (waterLoc !== -1) {
        tiles[waterLoc] = STEAM
        tiles[idx] = EMPTY
        sim.markDirty(tx, ty)
        sim.reactivateAround(tx, ty)
        sim.markDirty(waterLoc % width, waterLoc / width | 0)
        sim.next.add(waterLoc)
        return
      }
    }

    // Ignite plant — only if the plant tile has an adjacent empty (air requirement)
    if (random() < 60) {
      let plantLoc = -1
      if (tb === PLANT) plantLoc = b
      else if (tbl === PLANT) plantLoc = bl
      else if (tbr === PLANT) plantLoc = br
      else if (tl === PLANT) plantLoc = l
      else if (tr === PLANT) plantLoc = r
      else if (ta === PLANT) plantLoc = a
      else if (tal === PLANT) plantLoc = al
      else if (tar === PLANT) plantLoc = ar
      if (plantLoc !== -1 && !hasCounter(tiles[plantLoc])) {
        const px = plantLoc % width
        const py = plantLoc / width | 0
        if (sim.borderingAdjacent(px, py, plantLoc, EMPTY) !== -1) {
          const ownerId = getOwner(tiles[idx])
          tiles[plantLoc] = setCounter(setOwner(tiles[plantLoc], ownerId), PLANT_BURN_TICKS)
          sim.markDirty(px, py)
          sim.next.add(plantLoc)
        }
      }
    }

    // Wake fuse so it can self-detect adjacent fire and set its own burn counter
    if (random() < 80) {
      let fuseLoc = -1
      if (tb === FUSE) fuseLoc = b
      else if (tbl === FUSE) fuseLoc = bl
      else if (tbr === FUSE) fuseLoc = br
      else if (tl === FUSE) fuseLoc = l
      else if (tr === FUSE) fuseLoc = r
      else if (ta === FUSE) fuseLoc = a
      else if (tal === FUSE) fuseLoc = al
      else if (tar === FUSE) fuseLoc = ar
      if (fuseLoc !== -1) {
        sim.next.add(fuseLoc)
        sim.next.add(idx)
      }
    }

    // Melt wax → falling wax (passive, so fire must handle it directly)
    if (random() < 30) {
      let waxLoc = -1
      if (tb === WAX) waxLoc = b
      else if (tbl === WAX) waxLoc = bl
      else if (tbr === WAX) waxLoc = br
      else if (tl === WAX) waxLoc = l
      else if (tr === WAX) waxLoc = r
      else if (ta === WAX) waxLoc = a
      else if (tal === WAX) waxLoc = al
      else if (tar === WAX) waxLoc = ar
      if (waxLoc !== -1) {
        tiles[waxLoc] = FALLING_WAX
        sim.markDirty(waxLoc % width, waxLoc / width | 0)
        sim.next.add(waxLoc)
        sim.next.add(idx)
      }
    }

    // Wake C4 — adds it to next so its own explosion action runs (passive, can't self-wake)
    if (random() < 80) {
      let c4Loc = -1
      if (tb === C4) c4Loc = b
      else if (tbl === C4) c4Loc = bl
      else if (tbr === C4) c4Loc = br
      else if (tl === C4) c4Loc = l
      else if (tr === C4) c4Loc = r
      else if (ta === C4) c4Loc = a
      else if (tal === C4) c4Loc = al
      else if (tar === C4) c4Loc = ar
      if (c4Loc !== -1) {
        sim.next.add(c4Loc)
        sim.next.add(idx)
      }
    }

    // Age-based self-extinguish
    if (age <= 1) {
      tiles[idx] = EMPTY
      sim.markDirty(tx, ty)
      sim.reactivateAround(tx, ty)
      return
    }
    tiles[idx] = setCounter(tiles[idx], age - 1)
    sim.markDirty(tx, ty)

    // Rise upward
    if (random() < 50) {
      if (sim.tryRise(idx, tx, ty)) return
    }

    sim.next.add(idx)
  },
} satisfies MatterDef

export default FIRE_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [FIRE]: typeof FIRE_DEF;
  }
}
