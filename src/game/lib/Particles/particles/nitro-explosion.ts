import { PARTICLE_FIRE_COLOR } from '../../../config/colors.ts'
import { TWO_PI } from '../../../helpers/_helpers.ts'
import { FIRE, setOwner } from '../../Matter/_Matter.types.ts'
import { type ParticleDef } from '../_particle-types.ts'

export const NITRO_EXPLOSION: ParticleDef = {
  particlesToSpawn: 20,
  init(p) {
    p.color = PARTICLE_FIRE_COLOR
    const velocity = 8 + Math.random() * 14
    p.setVelocity(velocity, Math.random() * TWO_PI)
    p.size = 3 + Math.random() * 9
  },
  action(p, renderer, pool, world) {
    const x2 = p.x + p.xVelocity
    const y2 = p.y + p.yVelocity
    renderer.drawThickLine(p.x, p.y, x2, y2, p.size, p.color)
    world.setTileType(Math.round(x2), Math.round(y2), setOwner(FIRE, p.ownerId))
    p.x = x2
    p.y = y2
    if (p.actionIterations % 4 === 0) p.size /= 1.35
    p.yVelocity += 0.5
    if (p.size < 1.5) pool.release(p)
    else if (world.outOfBounds(p)) pool.release(p)
  },
}
