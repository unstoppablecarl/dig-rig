import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { BURNING_THERMITE, EMPTY, FIRE, LAVA, OIL, SALT_WATER, SOLID, THERMITE, TYPE_MASK, WATER } from '../_Matter-types.ts'
import { MatterCoordinatorOutMsg } from '../MatterSim.types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: BURNING_THERMITE,
  name: 'Burning Thermite',
  sinksThrough: [WATER, SALT_WATER, OIL],
  action(world, tx, ty, idx, next): void {
    const { tiles, width, height } = world

    // Set adjacent non-thermite/lava/solid to fire (up, left, right only)
    const sideNeighbors = [
      [tx, ty - 1, idx - width],
      [tx - 1, ty, idx - 1],
      [tx + 1, ty, idx + 1],
    ] as [number, number, number][]

    for (const [nx, ny, nidx] of sideNeighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      const nt = tiles[nidx] & TYPE_MASK
      if (nt !== THERMITE && nt !== BURNING_THERMITE && nt !== LAVA && nt !== SOLID) {
        tiles[nidx] = FIRE
        world.markDirty(nx, ny)
        next.add(nidx)
      }
    }

    // Burn through SOLID adjacent horizontally
    if (random() < 8) {
      const wallLeft = tx > 0 && (tiles[idx - 1] & TYPE_MASK) === SOLID ? idx - 1 : -1
      const wallRight = tx < width - 1 && (tiles[idx + 1] & TYPE_MASK) === SOLID ? idx + 1 : -1
      const wallBelow = ty < height - 1 && (tiles[idx + width] & TYPE_MASK) === SOLID ? idx + width : -1
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
      postMessage({ type: MatterCoordinatorOutMsg.SPAWN_PARTICLE, particleType: ParticleType.CHARGED_NITRO, x: tx, y: ty })
      tiles[idx] = FIRE
      world.markDirty(tx, ty)
      next.add(idx)
    }
  },
}

export default def
