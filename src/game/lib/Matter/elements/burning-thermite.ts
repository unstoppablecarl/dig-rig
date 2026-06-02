import { random } from '../../../helpers/random'
import {
  BURNING_THERMITE, EMPTY, FIRE, MatterType, SOLID, THERMITE,
} from '../_Matter-types.ts'
import { MatterWorkerOutMsg } from '../_MatterWorker-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.BURNING_THERMITE,
  name: 'Burning Thermite',
  action(world, tx, ty, idx, next): void {
    const { tiles, width, height } = world

    // Set adjacent non-thermite/lava/solid to fire (up, left, right only)
    const sideNeighbors = [
      [tx, ty - 1, idx - width],
      [tx - 1, ty, idx - 1   ],
      [tx + 1, ty, idx + 1   ],
    ] as [number, number, number][]

    for (const [nx, ny, nidx] of sideNeighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      const nt = tiles[nidx] & 0x7F
      if (nt !== THERMITE && nt !== BURNING_THERMITE && nt !== MatterType.LAVA && nt !== SOLID) {
        tiles[nidx] = FIRE
        world.markDirty(nx, ny)
        next.add(nidx)
      }
    }

    // Burn through SOLID adjacent horizontally
    if (random() < 8) {
      const wallLeft  = tx > 0          && (tiles[idx - 1]     & 0x7F) === SOLID ? idx - 1 : -1
      const wallRight = tx < width - 1  && (tiles[idx + 1]     & 0x7F) === SOLID ? idx + 1 : -1
      const wallBelow = ty < height - 1 && (tiles[idx + width] & 0x7F) === SOLID ? idx + width : -1
      for (const widx of [wallLeft, wallRight, wallBelow]) {
        if (widx === -1) continue
        tiles[widx] = EMPTY
        const wx = widx % width
        const wy = widx / width | 0
        world.markDirty(wx, wy)
        world.reactivateAround(wx, wy, next)
      }
    }

    // Slow self-consume
    if (random() < 2) {
      tiles[idx] = FIRE
      world.markDirty(tx, ty)
      next.add(idx)
      return
    }

    // Gravity fall (heavy dense material)
    const moved = world.tryMove(idx, tx, ty, tx, ty + 1, BURNING_THERMITE, next)
    if (!moved) next.add(idx)

    // Spawn charged particle occasionally
    if (random() < 2 && random() < 7) {
      postMessage({ type: MatterWorkerOutMsg.SPAWN_PARTICLE, particleType: 'charged_nitro', x: tx, y: ty })
      tiles[idx] = FIRE
      world.markDirty(tx, ty)
      next.add(idx)
    }
  },
}

export default def
