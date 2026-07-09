import { Math as PMath } from 'phaser'
import { FIRE, setOwner } from '../../Matter/_Matter.types.ts'
import type { ParticleSim } from '../../MatterEngine/workers/ParticleSim/ParticleSim.ts'
import { type ParticleDef } from '../_particle-types.ts'
import type { Particle } from '../Particle.ts'
import Vector2 = PMath.Vector2

const v = new Vector2()
export const FLAMETHROWER_BURST = {
  spawn(pool, _sim, particleType, x, y, ownerId, vx, vy) {
    const p = pool.acquire(particleType, x, y, ownerId)
    if (!p) return
    p.xVelocity = vx!
    p.yVelocity = vy!
    p.size = 3
  },
  action(p: Particle, sim: ParticleSim) {
    const dx = p.x + p.xVelocity
    const dy = p.y + p.yVelocity
    const fire = setOwner(FIRE, p.ownerId)
    // sim.fillCircle(p.x, p.y, p.size, fire)
    v.set(p.xVelocity, p.yVelocity).normalize().scale(10).add(p)
    sim.fillLine(p.x, p.y, v.x, v.y, p.size, fire)

    p.x = dx
    p.y = dy
    p.yVelocity += 0.3

    if (p.actionIterations > 50) {
      sim.pool.release(p)
    }
  },
} satisfies ParticleDef

