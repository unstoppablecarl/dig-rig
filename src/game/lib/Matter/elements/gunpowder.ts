import { FIRE, GUNPOWDER, MatterType, SETTLED_FLAG } from '../_Matter-types.ts'
import { rng } from '../MatterWorld.ts'
import { MatterWorkerOutMsg } from '../_MatterWorker-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: MatterType.GUNPOWDER,
  name: 'Gunpowder',
  action(world, tx, ty, idx, next): void {
    // Explode near fire
    if (rng() < 95 && world.bordering(tx, ty, idx, FIRE) !== -1) {
      const { tiles, width, height } = world
      const burn = rng() < 60

      // 3×3 blast radius
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = tx + dx, ny = ty + dy
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          tiles[ny * width + nx] = burn ? FIRE : GUNPOWDER
          world.markDirty(nx, ny)
          next.add(ny * width + nx)
        }
      }

      // Spawn visual particle via main thread
      postMessage({ type: MatterWorkerOutMsg.SPAWN_PARTICLE, particleType: 'gunpowder_explosion', x: tx, y: ty })
      return
    }

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx,                        ty + 1, GUNPOWDER, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, GUNPOWDER, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ?  1 : -1), ty + 1, GUNPOWDER, next)

    if (!moved) {
      world.tiles[idx] = GUNPOWDER | SETTLED_FLAG
      world.markDirty(tx, ty)
    }
  },
}

export default def
