import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import {
  EMPTY,
  FIRE,
  getFirstOwnerId,
  GUNPOWDER,
  type MatterDef,
  matterType,
  PERMANENT,
  setOwner,
  setSettled,
} from '../_Matter.types.ts'

export const GUNPOWDER_DEF = {
  id: GUNPOWDER,
  name: 'Gunpowder',
  hasOwnerId: true as const,
  settles: true as const,
  action(sim, tx, ty, idx): void {

    if (random() < 95) {
      const { tiles, width, height } = sim
      const fireIdx = sim.bordering(tx, ty, idx, FIRE)
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
                if (neighborType !== EMPTY) sim.queueMatterCredit(nx, ny, ownerId)
                tiles[nidx] = newFire
                sim.markDirty(nx, ny)
                sim.next.add(nidx)
              }
            } else if (neighborType === GUNPOWDER) {
              tiles[nidx] = setSettled(neighborRaw, false)
              sim.markDirty(nx, ny)
              sim.next.add(nidx)
            }
          }
        }

        sim.spawnParticle(ParticleType.GUNPOWDER_EXPLOSION, tx, ty, ownerId)

        return
      }
    }

    sim.doPowderFall(tx, ty, idx)
  },
} satisfies MatterDef

export default GUNPOWDER_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [GUNPOWDER]: typeof GUNPOWDER_DEF;
  }
}
