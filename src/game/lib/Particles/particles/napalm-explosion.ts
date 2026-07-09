import { randomRange, randomRangeInt } from '../../../helpers/random.ts'
import { FIRE, setOwner } from '../../Matter/_Matter.types.ts'
import { type ParticleDef } from '../_particle-types.ts'

const PARTICLES_TO_SPAWN = 6
export const NAPALM_EXPLOSION = {
  spawn(pool, _sim, particleType, x, y, ownerId) {
    for (let i = 0; i < PARTICLES_TO_SPAWN; i++) {
      const p = pool.acquire(particleType, x, y, ownerId)
      if (!p) break
      p.size = randomRange(8, 14)
      p.xVelocity = randomRange(-4, 4)
      p.yVelocity = randomRange(-8, -4)
      p.maxIterations = randomRangeInt(5, 15)
    }
  },
  action(p, sim) {
    const fire = setOwner(FIRE, p.ownerId)
    sim.fillCircle(p.x, p.y, p.size * 0.5, fire)
    p.x += p.xVelocity
    p.y += p.yVelocity
    p.size *= randomRange(1, 1.1)
    if (p.actionIterations > p.maxIterations || sim.outOfBounds(p)) {
      sim.pool.release(p)
    }
  },
} satisfies ParticleDef
