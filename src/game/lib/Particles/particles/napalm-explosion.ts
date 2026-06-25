import { randomRange, randomRangeInt } from '../../../helpers/random.ts'
import { FIRE, setOwner } from '../../Matter/_Matter.types.ts'
import { type ParticleDef } from '../_particle-types.ts'

export const NAPALM_EXPLOSION: ParticleDef = {
  particlesToSpawn: 6,
  init(p) {
    p.size = randomRange(8, 14)
    p.xVelocity = randomRange(-4, 4)
    p.yVelocity = randomRange(-8, -4)
    p.maxIterations = randomRangeInt(5, 15)
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
}
