import { PARTICLE_FIRE_COLOR } from '../../../config/colors.ts'
import { FIRE, setOwner } from '../../Matter/_Matter.types.ts'
import { type ParticleDef } from '../_particle-types.ts'

export const METHANE_EXPLOSION: ParticleDef = {
  particlesToSpawn: 3,
  init(p) {
    p.color = PARTICLE_FIRE_COLOR
    p.size = 10 + Math.random() * 10
  },
  action(p, sim) {
    sim.data.drawCircleFromParticle(p, p.size, p.color)
    sim.writeTileCircle(p.x, p.y, p.size / 2, setOwner(FIRE, p.ownerId))
    if (p.actionIterations > 2) sim.pool.release(p)
  },
}