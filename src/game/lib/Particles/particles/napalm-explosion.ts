import { PARTICLE_FIRE_COLOR } from '../../../config/colors.ts'
import { FIRE, setOwner } from '../../Matter/_Matter.types.ts'
import { type ParticleDef } from '../_particle-types.ts'

export const NAPALM_EXPLOSION: ParticleDef = {
  particlesToSpawn: 6,
  init(p) {
    p.color = PARTICLE_FIRE_COLOR
    p.size = Math.random() * 8 + 6
    p.xVelocity = Math.random() * 8 - 4
    p.yVelocity = -(Math.random() * 4 + 4)
    p.data.maxIter = Math.floor(Math.random() * 10) + 5
  },
  action(p, sim) {
    sim.data.drawCircleFromParticle(p, p.size, p.color)
    sim.writeTileCircle(p.x, p.y, p.size / 2, setOwner(FIRE, p.ownerId))
    p.x += p.xVelocity
    p.y += p.yVelocity
    p.size *= 1 + Math.random() * 0.1
    if (p.actionIterations > p.data.maxIter || sim.outOfBounds(p)) sim.pool.release(p)
  },
}
