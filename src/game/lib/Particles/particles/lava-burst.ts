import { EIGHTEENTH_PI, HALF_PI, QUARTER_PI } from '../../../helpers/_helpers.ts'
import { randomRange } from '../../../helpers/random.ts'
import {
  CHILLED_ICE,
  CRYO,
  FIRE,
  ICE,
  LAVA,
  MatterType,
  ROCK,
  SALT_WATER,
  setOwner,
  SOLID,
  WATER,
} from '../../Matter/_Matter.types.ts'
import { type ParticleDef } from '../_particle-types.ts'

const PARTICLES_TO_SPAWN = 5

export const LAVA_BURST = {
  spawn(pool, _sim, particleType, x, y, ownerId) {
    for (let i = 0; i < PARTICLES_TO_SPAWN; i++) {
      const p = pool.acquire(particleType, x, y, ownerId)
      if (!p) break

      // Bias angle away from straight-up to avoid overly vertical trajectories
      let angle = QUARTER_PI + Math.random() * HALF_PI
      if (Math.random() < 0.75 && Math.abs(HALF_PI - angle) < EIGHTEENTH_PI) {
        angle += EIGHTEENTH_PI * (angle > HALF_PI ? 1 : -1)
      }
      p.xVelocity = randomRange(1, 4) * Math.cos(angle)
      p.yVelocity = randomRange(-7, -4) * Math.sin(angle)
      p.initY = p.y
      p.initYVelocity = p.yVelocity
      p.yAcceleration = 0.06
      p.size = randomRange(4, 7)
      p.y -= p.size
    }
  },
  action(p, sim) {
    const x2 = p.x + p.xVelocity
    const y2 = p.initY
      + p.initYVelocity * p.actionIterations
      + (p.yAcceleration * p.actionIterations * p.actionIterations) * 0.5
    const fire = setOwner(FIRE, p.ownerId)
    sim.fillLine(p.x, p.y, x2, y2, p.size, fire)
    p.x = x2
    p.y = y2

    // 25% chance per frame: check what matterType the tip is about to hit
    if (Math.random() < 0.25) {
      // Update yVelocity to the current value so tileAtTip uses the right direction
      p.yVelocity = p.initYVelocity + p.yAcceleration * p.actionIterations
      const tile = sim.tileAtTip(p)
      let replaceType: MatterType | null = null
      if (tile === WATER || tile === SALT_WATER) {
        if (Math.random() < 0.58) {
          replaceType = ROCK
        }
      } else if (tile === LAVA || tile === ROCK) {
        if (Math.random() < 0.75) {
          replaceType = LAVA
        }
      } else if (tile === ICE || tile === CHILLED_ICE || tile === CRYO) {
        if (Math.random() < 0.70) {
          replaceType = ROCK
        }
      } else if (tile === SOLID) {
        if (Math.random() < 0.25) {
          replaceType = LAVA
        }
      }
      if (replaceType !== null) {
        sim.fillCircle(p.x, p.y, p.size * 0.5, replaceType)
        sim.pool.release(p)
        return
      }
    }
  },
} satisfies ParticleDef
