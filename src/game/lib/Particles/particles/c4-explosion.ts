import { FIRE, setOwner } from '../../Matter/_Matter.types.ts'
import { type ParticleDef } from '../_particle-types.ts'

const SIZE_DECAY_RATE = 0.66

export const C4_EXPLOSION: ParticleDef = {
  particlesToSpawn: 8,
  init(p) {
    const roll = Math.random()
    let maxSize: number
    if (roll < 0.9) {
      maxSize = 10
    } else if (roll < 0.95) {
      maxSize = 32
    } else if (roll < 0.98) {
      maxSize = 64
    } else {
      maxSize = 128
    }
    p.size = Math.random() * maxSize + 3
  },
  action(p, sim) {
    sim.fillCircle(p.x, p.y, p.size * 0.5, setOwner(FIRE, p.ownerId))
    p.size *= SIZE_DECAY_RATE
    if (p.size <= 1) {
      sim.pool.release(p)
    }
  },
}