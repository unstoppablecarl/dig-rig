import { randomRange } from '../../../helpers/random.ts'
import { FIRE, setOwner } from '../../Matter/_Matter.types.ts'
import { type ParticleDef } from '../_particle-types.ts'

export const METHANE_EXPLOSION: ParticleDef = {
  particlesToSpawn: 1,
  init(p) {
    p.size = randomRange(10, 20)
  },
  action(p, sim) {
    const fire = setOwner(FIRE, p.ownerId)
    sim.fillCircle(p.x, p.y, p.size * 0.5, fire)
    if (p.actionIterations > 2) {
      sim.pool.release(p)
    }
  },
}