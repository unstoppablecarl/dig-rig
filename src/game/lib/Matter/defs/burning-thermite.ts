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
  PERMANENT,
  SALT_WATER,
  setOwner,
  SOLID,
  THERMITE,
  WATER,
} from '../_Matter.types.ts'
import { MatterTypeSet } from '../data/MatterTypeSet'
import { registerMatterType } from '../matter.ts'
import { MatterCoordinatorOutMsg } from '../MatterSim.types.ts'

const NOT_FIRE_SPREADABLE = new MatterTypeSet(THERMITE, BURNING_THERMITE, LAVA, SOLID)
export const BURNING_THERMITE_DEF = {
  name: 'Burning Thermite',
  sinksThrough: [WATER, SALT_WATER, OIL],
  action(world, tx, ty, idx): void {
    const { tiles, width, height, leftFirst } = world

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
        tiles[nidx] = setOwner(FIRE, ownerId)
        world.markDirty(nx, ny)
        world.next.add(nidx)
      }
    }

    // Burn through NON-Permanent adjacent horizontally
    if (random() < 8) {
      const wallLeft = tx > 0 && matterType(tiles[idx - 1]) !== PERMANENT ? idx - 1 : -1
      const wallRight = tx < width - 1 && matterType(tiles[idx + 1]) !== PERMANENT ? idx + 1 : -1
      const wallBelow = ty < height - 1 && matterType(tiles[idx + width]) !== PERMANENT ? idx + width : -1

      const neighbors: number[] = [
        leftFirst ? wallLeft : wallRight,
        leftFirst ? wallRight : wallLeft,
        wallBelow,
      ]

      for (const widx of neighbors) {
        if (widx === -1) continue
        tiles[widx] = EMPTY
        const wx = widx % width
        const wy = widx / width | 0
        world.queueMatterCredit(wx, wy, ownerId)
        world.markDirty(wx, wy)
        world.reactivateAround(wx, wy)
      }
    }

    // Slow self-consume
    if (random() < 2) {
      tiles[idx] = setOwner(FIRE, ownerId)
      world.markDirty(tx, ty)
      world.next.add(idx)
      return
    }

    // Gravity fall (heavy dense material)
    const moved = world.tryMove(idx, tx, ty, tx, ty + 1)
    if (!moved) world.next.add(idx)

    // Spawn charged particle occasionally
    if (random() < 2 && random() < 7) {
      postMessage({
        type: MatterCoordinatorOutMsg.SPAWN_PARTICLE,
        particleType: ParticleType.CHARGED_NITRO,
        x: tx,
        y: ty,
        ownerId,
      })
      tiles[idx] = setOwner(FIRE, ownerId)
      world.markDirty(tx, ty)
      world.next.add(idx)
    }
  },
}  satisfies MatterDef

registerMatterType(BURNING_THERMITE, BURNING_THERMITE_DEF)

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [BURNING_THERMITE]: typeof BURNING_THERMITE_DEF;
  }
}
