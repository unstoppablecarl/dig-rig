import { FIRE_COLOR } from '../../../config/colors.ts'
import { FIRE } from '../../Matter/_Matter-types.ts'
import { type ParticleDef } from '../_particle-types.ts'

export const C4_EXPLOSION: ParticleDef = {
  particlesToSpawn: 8,
  init(p) {
    p.color = FIRE_COLOR
    const r = Math.random() * 10000
    if (r < 9000) p.size = Math.random() * 10 + 3
    else if (r < 9500) p.size = Math.random() * 32 + 3
    else if (r < 9800) p.size = Math.random() * 64 + 3
    else p.size = Math.random() * 128 + 3
  },
  action(p, renderer, pool, world) {
    renderer.drawCircleFromParticle(p, p.size, p.color)
    world.writeTileCircle(p.x, p.y, p.size / 2, FIRE)
    if (p.actionIterations % 3 === 0) {
      p.size /= 3
      if (p.size <= 1) pool.release(p)
    }
  },
}