import { FIRE, setOwner } from '../../Matter/_Matter.types.ts'
import type { ParticleSim } from '../../MatterEngine/workers/ParticleSim/ParticleSim.ts'
import { type ParticleDef } from '../_particle-types.ts'
import type { Particle } from '../Particle.ts'


export const FLAMETHROWER_BURST = {
  particlesToSpawn: 1,
  init(p: Particle, _sim: ParticleSim, velX: number, velY: number) {
    p.xVelocity = velX
    p.yVelocity = velY
    p.size = 3
  },
  action(p: Particle, sim: ParticleSim) {
    const dx = p.x + p.xVelocity
    const dy = p.y + p.yVelocity
    const fire = setOwner(FIRE, p.ownerId)
    sim.fillLine(p.x, p.y, dx, dy, p.size, fire)

    sim.data.drawTile(p.x, p.y, 0xffff00ff)
    p.x = dx
    p.y = dy
    p.yVelocity += 0.3

    if (p.actionIterations > 50) {
      sim.pool.release(p)
    }
  },
} satisfies ParticleDef
