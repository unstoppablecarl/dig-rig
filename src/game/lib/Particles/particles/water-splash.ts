import { TWO_PI } from '../../../helpers/_helpers.ts'
import { randomRange } from '../../../helpers/random.ts'
import { WATER } from '../../Matter/_Matter.types.ts'
import { type ParticleDef } from '../_particle-types.ts'

export const WATER_SPLASH: ParticleDef = {
  particlesToSpawn: 5,
  init(p) {
    const velocity = randomRange(5, 15)
    const angle = Math.random() * TWO_PI
    p.setVelocity(velocity, angle)
    p.size = 1
  },
  action(p, sim) {
    const dx = p.x + p.xVelocity
    const dy = p.y + p.yVelocity
    sim.fillLine(p.x, p.y, dx, dy, p.size, WATER)

    p.x = dx
    p.y = dy
    p.yVelocity += 0.3
    if(p.size < 1.75 || sim.outOfBounds(p))
    {
      sim.pool.release(p)
    }
  },
}
