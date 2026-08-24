import { FIRE, setOwner } from '../../Matter/_Matter.types.ts'
import { type ParticleDef } from '../_particle-types.ts'

const SIZE_DECAY_RATE = 0.66

const PARTICLES_TO_SPAWN = 8
export const C4_EXPLOSION = {
  spawn(pool, _sim, particleType, x, y, ownerId) {
    for (let i = 0; i < PARTICLES_TO_SPAWN; i++) {
      const p = pool.acquire(particleType, x, y, ownerId)
      if (!p) break
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
    }
  },
  action(p, sim) {
    sim.fillCircle(p.x, p.y, p.size * 0.5, setOwner(FIRE, p.ownerId))
    p.size *= SIZE_DECAY_RATE
    if (p.size <= 1) {
      sim.pool.release(p)
    }
  },
} satisfies ParticleDef