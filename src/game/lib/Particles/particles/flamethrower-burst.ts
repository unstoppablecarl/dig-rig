import { Math as PMath } from 'phaser'
import { randomDegVarianceToRad, randomRangeInt } from '../../../helpers/random.ts'
import { FIRE, setOwner } from '../../Matter/_Matter.types.ts'
import type { ParticleSim } from '../../MatterEngine/workers/ParticleSim/ParticleSim.ts'
import { type ParticleDef } from '../_particle-types.ts'
import type { Particle } from '../Particle.ts'
import Vector2 = PMath.Vector2

const v = new Vector2()
const PARTICLES_TO_SPAWN = 3
const SPREAD_DEG = 15
const DRAG = 0.94
const BUOYANCY = 0.08
const JITTER_DEG = 6
export const FLAMETHROWER_BURST = {
  spawn(pool, _sim, particleType, x, y, ownerId, vx: number, vy: number) {

    for (let i = 0; i < PARTICLES_TO_SPAWN; i++) {
      v.set(vx, vy).rotate(randomDegVarianceToRad(SPREAD_DEG))
      const p = pool.acquire(particleType, x, y, ownerId)
      if (!p) return
      p.xVelocity = v.x
      p.yVelocity = v.y
      p.size = 1
      p.maxIterations = randomRangeInt(30, 60)
    }
  },
  action(p: Particle, sim: ParticleSim) {
    const dx = p.x + p.xVelocity
    const dy = p.y + p.yVelocity

    v.set(p.xVelocity, p.yVelocity)
    const dist = v.length()
    const fire = setOwner(FIRE, p.ownerId)
    v.normalize().scale(dist).add(p)
    sim.fillLine(p.x, p.y, v.x, v.y, p.size, fire)

    p.x = dx
    p.y = dy

    v.set(p.xVelocity, p.yVelocity).rotate(randomDegVarianceToRad(JITTER_DEG)).scale(DRAG)
    p.xVelocity = v.x
    p.yVelocity = v.y - BUOYANCY

    if (p.actionIterations > p.maxIterations) {
      sim.pool.release(p)
    }
  },
} satisfies ParticleDef

