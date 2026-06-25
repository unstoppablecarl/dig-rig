import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import {
  BURNING_THERMITE,
  EMPTY,
  FIRE,
  getOwner,
  LAVA,
  type MatterDef,
  matterType,
  OIL,
  SALT_WATER,
  setOwner,
  SOLID,
  THERMITE,
  WATER,
} from '../_Matter.types.ts'
import { MatterTypeSet } from '../data/MatterTypeSet'
import { isDestructible } from '../matter.ts'

const NOT_FIRE_SPREADABLE = new MatterTypeSet(THERMITE, BURNING_THERMITE, LAVA, SOLID)
export const BURNING_THERMITE_DEF = {
  id: BURNING_THERMITE,
  name: 'Burning Thermite',
  sinksThrough: [WATER, SALT_WATER, OIL],
  hasOwnerId: true as const,
  alwaysActive: true as const,
  action(sim, tx, ty, idx): void {
    const { tiles, width, height, leftFirst } = sim

    const ownerId = getOwner(tiles[idx])

    const left = [tx - 1, ty, idx - 1]
    const right = [tx + 1, ty, idx + 1]
    const sideNeighbors = [
      [tx, ty - 1, idx - width],
      leftFirst ? left : right,
      leftFirst ? right : left,
    ] as [number, number, number][]

    for (const [nx, ny, nidx] of sideNeighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      const neighborRaw = tiles[nidx]
      const nt = matterType(neighborRaw)
      if (!NOT_FIRE_SPREADABLE.has(nt)) {
        if (nt !== EMPTY) sim.queueMatterCredit(nx, ny, ownerId)
        tiles[nidx] = setOwner(FIRE, ownerId)
        sim.markDirty(nx, ny)
        sim.next.add(nidx)
      }
    }

    // Burn through NON-Permanent adjacent horizontally
    if (random() < 8) {
      const wallLeft = tx > 0 && isDestructible(matterType(tiles[idx - 1])) ? idx - 1 : -1
      const wallRight = tx < width - 1 && isDestructible(matterType(tiles[idx + 1])) ? idx + 1 : -1
      const wallBelow = ty < height - 1 && isDestructible(matterType(tiles[idx + width])) ? idx + width : -1

      const neighbors: number[] = [
        leftFirst ? wallLeft : wallRight,
        leftFirst ? wallRight : wallLeft,
        wallBelow,
      ]

      for (const widx of neighbors) {
        if (widx === -1) continue
        if (matterType(tiles[widx]) === EMPTY) continue
        const wx = widx % width
        const wy = widx / width | 0
        sim.queueMatterCredit(wx, wy, ownerId)
        sim.destroyTile(wx, wy, widx)
        sim.reactivateAround(wx, wy)
      }
    }

    // Slow self-consume
    if (random() < 2) {
      sim.queueMatterCredit(tx, ty, ownerId)
      tiles[idx] = setOwner(FIRE, ownerId)
      sim.markDirty(tx, ty)
      sim.next.add(idx)
      return
    }

    // Gravity fall (heavy dense material)
    const moved = sim.tryMove(idx, tx, ty, tx, ty + 1)
    if (!moved) sim.next.add(idx)

    // Spawn charged particle occasionally
    if (random() < 2 && random() < 7) {
      sim.spawnParticle(ParticleType.THERMITE_SPARK, tx, ty, ownerId)

      sim.queueMatterCredit(tx, ty, ownerId)
      tiles[idx] = setOwner(FIRE, ownerId)
      sim.markDirty(tx, ty)
      sim.next.add(idx)
    }
  },
}  satisfies MatterDef

export default BURNING_THERMITE_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [BURNING_THERMITE]: typeof BURNING_THERMITE_DEF;
  }
}
