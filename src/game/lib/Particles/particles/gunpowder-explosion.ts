import { TWO_PI } from '../../../helpers/_helpers.ts'
import { randomRange } from '../../../helpers/random.ts'
import { FIRE, setOwner } from '../../Matter/_Matter.types.ts'
import { type ParticleDef } from '../_particle-types.ts'

const SIZE_DECAY_RATE = 0.95

export const GUNPOWDER_EXPLOSION: ParticleDef = {
  particlesToSpawn: 12,
  init(p) {
    const velocity = randomRange(5, 15)
    const angle = Math.random() * TWO_PI
    p.setVelocity(velocity, angle)
    p.size = randomRange(2, 9)
  },
  action(p, sim) {
    const dx = p.x + p.xVelocity
    const dy = p.y + p.yVelocity
    const fire = setOwner(FIRE, p.ownerId)
    sim.fillLine(p.x, p.y, dx, dy, p.size, fire)

    p.x = dx
    p.y = dy
    p.yVelocity += 0.3
    p.size *= SIZE_DECAY_RATE
    if (p.size < 1.75 || sim.outOfBounds(p)) {
      sim.pool.release(p)
    }
  },
}
