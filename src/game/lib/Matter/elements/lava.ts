import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import {
  EMPTY, FIRE, LAVA, makeTypeMask,
  matterType, OIL, ROCK, SALT_WATER, setSettled, SOLID, STEAM, WATER,
} from '../_Matter-types.ts'
import { MatterCoordinatorOutMsg } from '../MatterSim.types.ts'
import { type ElementDef, LAVA_IMMUNE } from '../elements.ts'

const SETTLED_OK = makeTypeMask(LAVA, EMPTY)

export const LAVA_DEF: ElementDef = {
  name: 'Lava',
  lavaImmune: true,
  liquid: true,
  action(world, tx, ty, idx, next): void {
    const { tiles, width, height } = world

    // Turn to rock when touching water or salt-water
    let waterLoc = world.bordering(tx, ty, idx, WATER)
    if (waterLoc === -1) waterLoc = world.bordering(tx, ty, idx, SALT_WATER)
    if (waterLoc !== -1) {
      tiles[waterLoc] = STEAM
      tiles[idx] = ROCK
      world.markDirty(tx, ty)
      const wx = waterLoc % width
      const wy = waterLoc / width | 0
      world.markDirty(wx, wy)
      next.add(waterLoc)
      next.add(idx)
      return
    }

    // Spawn a lava burst particle and self-destruct when adjacent to oil
    if (random() < 4 && world.bordering(tx, ty, idx, OIL) !== -1) {
      if (random() < 35) {
        postMessage({ type: MatterCoordinatorOutMsg.SPAWN_PARTICLE, particleType: ParticleType.LAVA_BURST, x: tx, y: ty })
        tiles[idx] = EMPTY
        world.markDirty(tx, ty)
        world.reactivateAround(tx, ty, next)
        return
      }
    }

    // Slowly melt adjacent SOLID into LAVA (~0.5% chance, matching project-sand WALL→LAVA)
    if (random() < 1 && random() < 50) {
      const meltLoc = world.borderingAdjacent(tx, ty, idx, SOLID)
      if (meltLoc !== -1) {
        tiles[meltLoc] = LAVA
        const mx = meltLoc % width
        const my = meltLoc / width | 0
        world.markDirty(mx, my)
        next.add(meltLoc)
      }
    }

    // Spawn fire in empty space directly above
    const upIdx = ty > 0 ? idx - width : -1
    if (upIdx !== -1 && random() < 6 && matterType(tiles[upIdx]) === EMPTY) {
      tiles[upIdx] = FIRE
      world.markDirty(tx, ty - 1)
      next.add(upIdx)
    }

    // Burn adjacent non-immune tiles (4-directional, SOLID is lava-immune so skipped)
    if (random() < 25) {
      const burnCandidates: [number, number, number][] = [
        [tx, ty - 1, ty > 0 ? idx - width : -1],
        [tx, ty + 1, ty < height - 1 ? idx + width : -1],
        [tx - 1, ty, tx > 0 ? idx - 1 : -1],
        [tx + 1, ty, tx < width - 1 ? idx + 1 : -1],
      ]
      for (const [nx, ny, nidx] of burnCandidates) {
        if (nidx === -1) continue
        const nt = matterType(tiles[nidx])
        if (!LAVA_IMMUNE.has(nt)) {
          tiles[nidx] = FIRE
          world.markDirty(nx, ny)
          next.add(nidx)
        }
      }
    }

    // Clear fire directly below so lava can fall through it
    const downIdx = ty < height - 1 ? idx + width : -1
    if (downIdx !== -1) {
      const belowType = matterType(tiles[downIdx])
      if (belowType === FIRE) {
        tiles[downIdx] = EMPTY
        world.markDirty(tx, ty + 1)
        world.reactivateAround(tx, ty + 1, next)
      } else if (belowType === STEAM && random() < 95) {
        // Lava sinks through steam — swap positions
        tiles[downIdx] = LAVA
        tiles[idx] = STEAM
        world.markDirty(tx, ty)
        world.markDirty(tx, ty + 1)
        next.add(downIdx)
        next.add(idx)
        return
      }
    }

    // 15% chance to clear fire sideways so lava can flow horizontally through it
    if (random() < 15) {
      const leftIdx = tx > 0 ? idx - 1 : -1
      const rightIdx = tx < width - 1 ? idx + 1 : -1
      if (leftIdx !== -1 && matterType(tiles[leftIdx]) === FIRE) {
        tiles[leftIdx] = EMPTY
        world.markDirty(tx - 1, ty)
        world.reactivateAround(tx - 1, ty, next)
      }
      if (rightIdx !== -1 && matterType(tiles[rightIdx]) === FIRE) {
        tiles[rightIdx] = EMPTY
        world.markDirty(tx + 1, ty)
        world.reactivateAround(tx + 1, ty, next)
      }
    }

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx, ty + 1, LAVA, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, LAVA, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, LAVA, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1, next)

    if (!moved) {
      world.tiles[idx] = setSettled(LAVA, true)
      world.markDirty(tx, ty)

      if (!world.surroundedByMask(tx, ty, idx, SETTLED_OK)) {
        next.add(idx)
      }
    }
  },
}
