import { Math as PMath } from 'phaser'
import { randomDegVarianceToRad, randomRangeInt } from '../../../helpers/random.ts'
import {
  ACID,
  BURNING_FUEL,
  CRYO,
  EMPTY,
  FIRE,
  matterType,
  SALT_WATER,
  setOwner,
  WATER,
} from '../../Matter/_Matter.types.ts'
import { MatterTypeSet } from '../../Matter/data/MatterTypeSet.ts'
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

// Non-flammable liquids extinguish/block fire rather than burning — see burning-fuel.ts.
const NON_FLAMMABLE_LIQUID = new MatterTypeSet(WATER, SALT_WATER, ACID, CRYO)

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

    const currentIdx = Math.floor(p.y) * sim.width + Math.floor(p.x)
    let currentType = matterType(sim.tiles[currentIdx])
    if (currentType !== EMPTY && currentType !== FIRE) {
      sim.pool.release(p)
      return
    }

    const collideIdx = sim.doSolidCollision(p.x, p.y, p.xVelocity, p.yVelocity)
    if (collideIdx !== null) {
      const cx = collideIdx % sim.width
      const cy = collideIdx / sim.width | 0
      const fire = setOwner(FIRE, p.ownerId)
      sim.fillLineExcluding(p.x, p.y, cx, cy, NON_FLAMMABLE_LIQUID, fire)
      sim.setTile(collideIdx, setOwner(BURNING_FUEL, p.ownerId))
      sim.pool.release(p)
      return
    }
    v.set(p.xVelocity, p.yVelocity)
    const dist = v.length()
    const fire = setOwner(FIRE, p.ownerId)
    v.normalize().scale(dist).add(p)
    sim.fillLineExcluding(p.x, p.y, v.x, v.y, NON_FLAMMABLE_LIQUID, fire)

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

