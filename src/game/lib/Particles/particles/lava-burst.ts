import { LAVA_COLOR, ROCK_COLOR } from '../../../config/colors.ts'
import { EIGHTEENTH_PI, HALF_PI, QUARTER_PI } from '../../../helpers/_helpers.ts'
import {
  CHILLED_ICE,
  CRYO,
  FIRE,
  ICE,
  LAVA,
  MatterType,
  PERMANENT,
  ROCK,
  SALT_WATER, setOwner,
  SOLID,
  WATER,
} from '../../Matter/_Matter-types.ts'
import { type ParticleDef } from '../_particle-types.ts'

export const LAVA_BURST: ParticleDef = {
  particlesToSpawn: 5,
  init(p) {

    p.color = LAVA_COLOR
    // Bias angle away from straight-up to avoid overly vertical trajectories
    let angle = QUARTER_PI + Math.random() * HALF_PI
    if (Math.random() < 0.75 && Math.abs(HALF_PI - angle) < EIGHTEENTH_PI)
      angle += EIGHTEENTH_PI * (angle > HALF_PI ? 1 : -1)
    p.xVelocity = (1 + Math.random() * 3) * Math.cos(angle)
    p.yVelocity = (-4 * Math.random() - 3) * Math.sin(angle)
    p.data.initY = p.y
    p.data.initYVelocity = p.yVelocity
    p.data.yAcceleration = 0.06
    p.size = 4 + Math.random() * 3
    p.y -= p.size
  },
  action(p, renderer, pool, world) {
    const x2 = p.x + p.xVelocity
    const y2 = p.data.initY
      + p.data.initYVelocity * p.actionIterations
      + (p.data.yAcceleration * p.actionIterations * p.actionIterations) / 2
    renderer.drawThickLine(p.x, p.y, x2, y2, p.size, p.color)
    // Trail leaves fire in the world
    world.destroyTile(Math.round(x2), Math.round(y2), setOwner(FIRE, p.ownerId))
    p.x = x2
    p.y = y2

    // Allow the particle to arc above the canvas top but retire it off the sides or bottom
    if (p.x < 0 || p.x >= world.width || p.y >= world.height) {
      pool.release(p)
      return
    }

    // 25% chance per frame: check what matterType the tip is about to hit
    if (Math.random() < 0.25) {
      // Update yVelocity to the current value so tileAtTip uses the right direction
      p.yVelocity = p.data.initYVelocity + p.data.yAcceleration * p.actionIterations
      const tile = world.tileAtTip(p)
      let splatColor = -1
      let splatTile: MatterType | null = null
      if (tile === WATER || tile === SALT_WATER) {
        if (Math.random() < 0.58) {
          splatColor = ROCK_COLOR
          splatTile = ROCK
        }
      } else if (tile === LAVA || tile === ROCK) {
        if (Math.random() < 0.75) {
          splatColor = LAVA_COLOR
          splatTile = LAVA
        }
      } else if (tile === ICE || tile === CHILLED_ICE || tile === CRYO) {
        if (Math.random() < 0.70) {
          splatColor = ROCK_COLOR
          splatTile = ROCK
        }
      } else if (tile === SOLID || tile === PERMANENT) {
        if (Math.random() < 0.25) splatColor = LAVA_COLOR  // visual only — don't overwrite structural tiles
      }
      if (splatColor !== -1) {
        renderer.drawCircleFromParticle(p, p.size / 2, splatColor)
        if (splatTile !== null) world.writeTileCircle(p.x, p.y, p.size / 2, setOwner(splatTile, p.ownerId))
        pool.release(p)
        return
      }
    }
  },
}
