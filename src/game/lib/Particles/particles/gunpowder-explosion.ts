import { FIRE_COLOR } from '../../../config/colors.ts'
import { TWO_PI } from '../../../helpers/_helpers.ts'
import { MatterType } from '../../Matter/_Matter-types.ts'
import { type ParticleDef } from '../_particle-types.ts'

export const GUNPOWDER_EXPLOSION: ParticleDef = {
  particlesToSpawn: 12,
  init(p) {
    p.color = FIRE_COLOR
    const velocity = 5 + Math.random() * 10
    const angle = Math.random() * TWO_PI
    p.setVelocity(velocity, angle)
    p.size = 2 + Math.random() * 7
  },
  action(p, renderer, pool, world) {
    const x2 = p.x + p.xVelocity
    const y2 = p.y + p.yVelocity
    renderer.drawThickLine(p.x, p.y, x2, y2, p.size, p.color)
    world.destroyTile(Math.round(x2), Math.round(y2), MatterType.FIRE)
    p.x = x2
    p.y = y2
    p.yVelocity += 0.3
    if (p.actionIterations % 5 === 0) p.size /= 1.3
    if (p.size < 1.75) pool.release(p)
    else if (world.outOfBounds(p)) pool.release(p)
  },
}
