import { random } from '../../../helpers/random'
import {
  EMPTY, FIRE, LAVA, MatterType, OIL, ROCK, SALT_WATER, SETTLED_FLAG, STEAM, TYPE_MASK, WATER,
} from '../_Matter-types.ts'
import { MatterWorkerOutMsg } from '../_MatterWorker-types.ts'
import { ParticleType } from '../../Particles/_particle-types.ts'
import type { ElementDef } from '../elements.ts'

// Elements lava cannot burn
const LAVA_IMMUNE = new Set([LAVA, MatterType.SOLID, MatterType.PERMANENT, ROCK, WATER, SALT_WATER, STEAM])

const def: ElementDef = {
  id: MatterType.LAVA,
  name: 'Lava',
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
        postMessage({ type: MatterWorkerOutMsg.SPAWN_PARTICLE, particleType: ParticleType.LAVA_BURST, x: tx, y: ty })
        tiles[idx] = EMPTY
        world.markDirty(tx, ty)
        world.reactivateAround(tx, ty, next)
        return
      }
    }

    // Burn adjacent non-immune tiles (with proper X-boundary guards)
    if (random() < 25) {
      const burnCandidates: [number, number, number][] = [
        [tx,     ty - 1, ty > 0          ? idx - width : -1],
        [tx,     ty + 1, ty < height - 1 ? idx + width : -1],
        [tx - 1, ty,     tx > 0          ? idx - 1     : -1],
        [tx + 1, ty,     tx < width - 1  ? idx + 1     : -1],
      ]
      for (const [nx, ny, nidx] of burnCandidates) {
        if (nidx === -1) continue
        const nt = tiles[nidx] & TYPE_MASK
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
      const belowType = tiles[downIdx] & TYPE_MASK
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
      const leftIdx  = tx > 0         ? idx - 1 : -1
      const rightIdx = tx < width - 1 ? idx + 1 : -1
      if (leftIdx  !== -1 && (tiles[leftIdx]  & TYPE_MASK) === FIRE) {
        tiles[leftIdx] = EMPTY
        world.markDirty(tx - 1, ty)
        world.reactivateAround(tx - 1, ty, next)
      }
      if (rightIdx !== -1 && (tiles[rightIdx] & TYPE_MASK) === FIRE) {
        tiles[rightIdx] = EMPTY
        world.markDirty(tx + 1, ty)
        world.reactivateAround(tx + 1, ty, next)
      }
    }

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx,                         ty + 1, LAVA, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 :  1), ty + 1, LAVA, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ?  1 : -1), ty + 1, LAVA, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 :  1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ?  1 : -1, next)

    if (!moved) {
      world.tiles[idx] = LAVA | SETTLED_FLAG
      world.markDirty(tx, ty)
    }
  },
}

export default def
