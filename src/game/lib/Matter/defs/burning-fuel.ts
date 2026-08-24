import { random, shuffleArray } from '../../../helpers/random'
import {
  ACID,
  BURNING_FUEL,
  CRYO,
  EMPTY,
  FIRE,
  getOwner,
  LAVA,
  type MatterDef,
  matterType,
  type MatterType,
  OIL,
  PERMANENT,
  PHYSICS_BODY,
  SALT_WATER,
  setOwner,
  SOLID,
  THERMITE,
  WATER,
} from '../_Matter.types.ts'
import { MatterTypeSet } from '../data/MatterTypeSet'
import { isDestructible, isLiquid } from '../matter.ts'

// Burn-through only tunnels through solid walls — liquids (flammable or not) are handled by
// the side-spread ignite loop above, not by destroying/crediting them as a "wall".
const isBurnableWall = (t: MatterType) => isDestructible(t) && !isLiquid(t)

// Non-flammable liquids don't burn — excluded so fuel doesn't ignite/consume them as if they
// were fuel (see fire.ts, which instead has water extinguish fire, not the other way around).
const FIRE_SPREADABLE = MatterTypeSet.excluding(THERMITE, BURNING_FUEL, LAVA, SOLID, FIRE, WATER, SALT_WATER, ACID, CRYO).remove(new MatterTypeSet(PERMANENT, PHYSICS_BODY))
export const BURNING_FUEL_DEF = {
  id: BURNING_FUEL,
  name: 'Burning Fuel',
  sinksThrough: [WATER, SALT_WATER, OIL],
  hasOwnerId: true as const,
  alwaysActive: true as const,
  lavaBurnable: true as const,
  acidMeltable: true as const,
  action(sim, tx, ty, idx): void {
    const { tiles, width, height, leftFirst } = sim

    const currentValue = tiles[idx]
    const ownerId = getOwner(currentValue)

    const left = [tx - 1, ty, idx - 1]
    const right = [tx + 1, ty, idx + 1]
    const down = [tx, ty + 1, idx - width]

    const sideNeighbors = [
      down,
      leftFirst ? left : right,
      leftFirst ? right : left,
    ] as [number, number, number][]

    let burnMoved = false
    for (const [nx, ny, nidx] of sideNeighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      const neighborRaw = tiles[nidx]
      const nt = matterType(neighborRaw)
      if (FIRE_SPREADABLE.has(nt)) {
        if (nt !== EMPTY) sim.queueMatterCredit(nx, ny, ownerId)
        sim.consumeLiquidFill(nidx)
        tiles[nidx] = setOwner(FIRE, ownerId)

        sim.markDirty(nx, ny)
        sim.next.add(nidx)
      }
    }
    if (burnMoved) return // relocated into a fuel neighbor above; idx is now EMPTY

    // Burn through: eat into one adjacent destructible wall and advance into it,
    // so fuel stuck to a surface tunnels through it instead of hovering by the hole.
    if (random() < 12) {
      const wallLeft = tx > 0 && isBurnableWall(matterType(tiles[idx - 1])) ? idx - 1 : -1
      const wallRight = tx < width - 1 && isBurnableWall(matterType(tiles[idx + 1])) ? idx + 1 : -1
      const wallBelow = ty < height - 1 && isBurnableWall(matterType(tiles[idx + width])) ? idx + width : -1
      const wallAbove = ty > 0 && isBurnableWall(matterType(tiles[idx - width])) ? idx - width : -1

      const candidates: number[] = shuffleArray([
        wallBelow,
        wallAbove,
        leftFirst ? wallLeft : wallRight,
        leftFirst ? wallRight : wallLeft,
      ])

      for (const widx of candidates) {
        if (widx === -1) continue
        const wt = matterType(tiles[widx])
        // EMPTY: nothing to burn. FIRE: this tile's own side-spread just lit
        // that neighbor last tick — destroying it isn't "burning through a
        // wall", it's chasing its own flame sideways forever.
        if (wt === EMPTY || wt === FIRE) continue
        const wx = widx % width
        const wy = widx / width | 0
        sim.queueMatterCredit(wx, wy, ownerId)
        sim.destroyTile(wx, wy, widx)
        sim.reactivateAround(wx, wy)
        sim.tryMove(idx, tx, ty, wx, wy)
        return
      }
    }

    // Slow self-consume — no credit: burning fuel doesn't count as matter
    // (see Coordinator's computeMatterTotal/tileContribution), same as fire.
    if (random() < 2) {
      tiles[idx] = setOwner(FIRE, ownerId)
      sim.markDirty(tx, ty)
      sim.next.add(idx)
      return
    }

    const belowType = ty + 1 < height ? matterType(tiles[idx + width]) : SOLID
    const canFall = belowType === EMPTY
    const canStick = canFall && sim.canStickToAnyColliding(tx, ty, idx) !== -1
    if (canStick && random() < 95) {
      sim.next.add(idx)
      return
    }

    // Gravity fall (heavy dense material)
    const moved = sim.tryMove(idx, tx, ty, tx, ty + 1)
    if (!moved) sim.next.add(idx)
  },
}  satisfies MatterDef

export default BURNING_FUEL_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [BURNING_FUEL]: typeof BURNING_FUEL_DEF;
  }
}
