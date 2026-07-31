import { random } from '../../../helpers/random'
import {
  CHILLED_ICE,
  CRYO,
  EMPTY,
  getFirstOwnerId,
  getOwner,
  ICE,
  isSettled,
  LAVA,
  type MatterDef,
  matterType,
  OIL,
  ROCK,
  SALT_WATER,
  setOwner,
  setSettled,
  WATER,
} from '../_Matter.types.ts'
import { CRYO_STICKS_TO, CRYO_STICKS_TO_IF_SETTLED } from '../matter.ts'

export const CRYO_DEF = {
  id: CRYO,
  name: 'Cryo',
  hasOwnerId: true as const,
  settles: true as const,
  liquid: true as const,
  lavaBurnable: true as const,
  action(sim, tx, ty, idx): void {
    const { tiles, width, height } = sim
    const ownerId = getOwner(tiles[idx])

    // Lava contact: cryo evaporates, lava solidifies
    const lavaLoc = sim.bordering(tx, ty, idx, LAVA)
    if (lavaLoc !== -1) {
      const lavaRaw = tiles[lavaLoc]
      const combinedOwner = getFirstOwnerId(tiles[idx], lavaRaw)
      sim.queueMatterCredit(tx, ty, combinedOwner)
      sim.consumeLiquidFill(idx)
      tiles[idx] = EMPTY
      sim.consumeLiquidFill(lavaLoc)
      sim.notifySolidCreated()
      tiles[lavaLoc] = ROCK
      // idx becomes EMPTY (was CRYO, non-collidable) — render-only.
      sim.markRenderDirty(tx, ty)
      const lx = lavaLoc % width
      const ly = lavaLoc / width | 0
      sim.markDirty(lx, ly)
      sim.reactivateAround(tx, ty)
      return
    }

    // 3×3 scan: freeze surfaces and water/ice on contact (cryo is consumed)
    const xStart = Math.max(tx - 1, 0)
    const yStart = Math.max(ty - 1, 0)
    const xEnd = Math.min(tx + 2, width)
    const yEnd = Math.min(ty + 2, height)

    for (let ny = yStart; ny < yEnd; ny++) {
      for (let nx = xStart; nx < xEnd; nx++) {
        if (ny === ty && nx === tx) continue
        const nidx = ny * width + nx
        const nRaw = tiles[nidx]
        const nt = matterType(nRaw)

        // Touching CHILLED_ICE: rare self-freeze (1% × 5%)
        if (nt === CHILLED_ICE && random() < 1 && random() < 5) {
          sim.consumeLiquidFill(idx)
          sim.notifySolidCreated()
          tiles[idx] = setOwner(CHILLED_ICE, ownerId)
          sim.markDirty(tx, ty)
          sim.reactivateAround(tx, ty)
          return
        }

        // Touching a solid surface: cryo freezes onto it
        if (CRYO_STICKS_TO.has(nt) || (CRYO_STICKS_TO_IF_SETTLED.has(nt) && isSettled(nRaw))) {
          sim.consumeLiquidFill(idx)
          sim.notifySolidCreated()
          tiles[idx] = setOwner(CHILLED_ICE, ownerId)
          sim.markDirty(tx, ty)
          sim.reactivateAround(tx, ty)
          return
        }

        // Touching water or ice: both freeze, cryo is consumed
        if (nt === WATER || nt === ICE) {
          if (nt === WATER) {
            sim.consumeLiquidFill(nidx)
            sim.notifySolidCreated()
          }
          // ICE → CHILLED_ICE: solid→solid, no domain change
          tiles[nidx] = CHILLED_ICE
          sim.markDirty(nx, ny)
          sim.next.add(nidx)
          sim.consumeLiquidFill(idx)
          sim.notifySolidCreated()
          tiles[idx] = setOwner(CHILLED_ICE, ownerId)
          sim.markDirty(tx, ty)
          sim.reactivateAround(tx, ty)
          return
        }
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

    const moved = sim.doPowderFall(tx, ty, idx)
    if (!moved) {
      // Random self-freeze if immobile (~0.5% = 1% × 50%)
      if (random() < 1 && random() < 50) {
        sim.consumeLiquidFill(idx)
        sim.notifySolidCreated()
        tiles[idx] = setOwner(CHILLED_ICE, ownerId)
        sim.markDirty(tx, ty)
        sim.reactivateAround(tx, ty)
        return
      }

      tiles[idx] = setSettled(tiles[idx], true)
      sim.markRenderDirty(tx, ty)
    }
  },
} satisfies MatterDef

export default CRYO_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [CRYO]: typeof CRYO_DEF;
  }
}
