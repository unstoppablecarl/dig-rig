import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import {
  FIRE,
  getFirstOwnerId,
  GUNPOWDER,
  type MatterDef,
  matterType,
  PERMANENT,
  setOwner,
  setSettled,
} from '../_Matter-types.ts'
import { MatterCoordinatorOutMsg } from '../MatterSim.types.ts'

export const GUNPOWDER_DEF: MatterDef = {
  name: 'Gunpowder',
  action(world, tx, ty, idx): void {

    if (random() < 95) {
      const { tiles, width, height } = world
      const fireIdx = world.bordering(tx, ty, idx, FIRE)
      if (fireIdx !== -1) {
        const existingRaw = tiles[idx]
        const fireRaw = tiles[fireIdx]
        const ownerId = getFirstOwnerId(existingRaw, fireRaw)
        const burn = random() < 60
        const newFire = setOwner(FIRE, ownerId)

        // 3×3 blast radius
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = tx + dx, ny = ty + dy
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue

            const nidx = ny * width + nx
            const neighborRaw = tiles[nidx]
            const neighborType = matterType(neighborRaw)
            if (burn) {
              if (neighborType !== PERMANENT) {
                world.queueMatterCreditFromTile(nx, ny, nidx)
                tiles[nidx] = newFire
                world.markDirty(nx, ny)
                world.next.add(nidx)
              }
            } else if (neighborType === GUNPOWDER) {
              tiles[nidx] = setSettled(neighborRaw, false)
              world.markDirty(nx, ny)
              world.next.add(nidx)
            }
          }
        }

        // Spawn visual particle via main thread
        postMessage({
          type: MatterCoordinatorOutMsg.SPAWN_PARTICLE,
          particleType: ParticleType.GUNPOWDER_EXPLOSION,
          x: tx,
          y: ty,
          ownerId,
        })
        return
      }
    }

    world.doPowderFall(tx, ty, idx)
  },
}
