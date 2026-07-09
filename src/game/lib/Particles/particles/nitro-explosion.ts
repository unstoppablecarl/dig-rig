import { TWO_PI } from '../../../helpers/_helpers.ts'
import { randomRange } from '../../../helpers/random.ts'
import { FIRE, setOwner } from '../../Matter/_Matter.types.ts'
import { type ParticleDef } from '../_particle-types.ts'

const PARTICLES_TO_SPAWN = 20
export const NITRO_EXPLOSION = {
  spawn(pool, _sim, particleType, x, y, ownerId) {
    for (let i = 0; i < PARTICLES_TO_SPAWN; i++) {
      const p = pool.acquire(particleType, x, y, ownerId)
      if (!p) break
      const velocity = randomRange(8, 22)
      p.setVelocity(velocity, Math.random() * TWO_PI)
      p.size = randomRange(3, 12)
    }
  },
  action(p, sim) {
    const fire = setOwner(FIRE, p.ownerId)
    const x2 = p.x + p.xVelocity
    const y2 = p.y + p.yVelocity
    sim.fillLine(p.x, p.y, x2, y2, p.size, fire)
    sim.fillTile(Math.round(x2), Math.round(y2), fire)
    p.x = x2
    p.y = y2
    if (p.actionIterations % 4 === 0) p.size /= 1.35
    p.yVelocity += 0.5
    if (p.size < 1.5) sim.pool.release(p)
    else if (sim.outOfBounds(p)) sim.pool.release(p)
  },
} satisfies ParticleDef
