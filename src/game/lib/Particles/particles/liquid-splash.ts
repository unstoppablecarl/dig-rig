import { colorToPixelRGBA, rgbaToColor } from '../../../helpers/color-converters.ts'
import { randomRange } from '../../../helpers/random.ts'
import { ACID, CRYO, LAVA, NAPALM, OIL, SALT_WATER, WATER } from '../../Matter/_Matter.types.ts'
import type { LiquidTypes } from '../../Matter/matter.ts'
import { type ParticleDef } from '../_particle-types.ts'

// Rendered droplet color per liquid type — falls back to WATER's color for any liquid without
// an explicit entry (e.g. a new liquid type added later) rather than failing to render.
const SPLASH_COLORS: Record<LiquidTypes, number> = {
  [WATER]: colorToPixelRGBA(rgbaToColor(`rgb(0, 166, 255, 255)`)),
  [SALT_WATER]: colorToPixelRGBA(rgbaToColor(`rgb(60, 200, 190, 255)`)),
  [LAVA]: colorToPixelRGBA(rgbaToColor(`rgb(255, 90, 0, 255)`)),
  [OIL]: colorToPixelRGBA(rgbaToColor(`rgb(60, 40, 20, 255)`)),
  [ACID]: colorToPixelRGBA(rgbaToColor(`rgb(140, 255, 60, 255)`)),
  [NAPALM]: colorToPixelRGBA(rgbaToColor(`rgb(180, 90, 20, 255)`)),
  [CRYO]: colorToPixelRGBA(rgbaToColor(`rgb(150, 220, 255, 255)`)),
}
const DEFAULT_SPLASH_COLOR = SPLASH_COLORS[WATER]

// Each spawned particle carries exactly 1 fill unit, debited from the source tile by
// PhysicsBodyProcessor when the splash is spawned and credited back here on landing —
// keeps the droplet's mass conserved instead of conjuring a full FILL_MAX tile out of thin air.
const SPLASH_FILL_UNIT = 1
const LIQUID_SPLASH_PARTICLE_COUNT = 5
const LIQUID_SPLASH_VELOCITY_MULTIPLIER = 0.1

export const LIQUID_SPLASH = {
  // type is the liquid being displaced; velX/velY are the source body's velocity, already
  // scaled by PhysicsBodyProcessor's LIQUID_SPLASH_VELOCITY_MULTIPLIER.
  spawn(pool, sim, particleType, x, y, _ownerId, vx, vy, value) {
    const tx = Math.floor(x)
    const ty = Math.floor(y)
    const idx = ty * sim.width + tx

    if (sim.fill[idx] <= LIQUID_SPLASH_PARTICLE_COUNT) return

    sim.fill[idx] -= LIQUID_SPLASH_PARTICLE_COUNT
    sim.conservationTracker.addDelta(-LIQUID_SPLASH_PARTICLE_COUNT)
    const splashVelX = vx! * LIQUID_SPLASH_VELOCITY_MULTIPLIER
    const splashVelY = vy! * LIQUID_SPLASH_VELOCITY_MULTIPLIER
    const speed = Math.hypot(splashVelX, splashVelY)

    // One particle per debited fill unit — each carries SPLASH_FILL_UNIT and credits it
    // back on landing (see action()), so debiting LIQUID_SPLASH_PARTICLE_COUNT above without
    // spawning that many droplets would destroy fill instead of conserving it.
    for (let i = 0; i < LIQUID_SPLASH_PARTICLE_COUNT; i++) {
      const p = pool.acquire(particleType, x, y, undefined)
      if (!p) break

      p.liquidType = value!
      // Sprays away from the body's direction of travel (bow-wave), tipped upward, with
      // jitter so a stream of droplets fans out instead of firing in lockstep.
      const away = Math.atan2(splashVelY, splashVelX) + Math.PI + randomRange(-0.6, 0.6)
      p.setVelocity(speed, away)
      p.yVelocity -= randomRange(2, 5)
      p.size = 1
    }
  },
  action(p, sim) {
    const collisionIdx = sim.checkForCollision(p.x, p.y, p.xVelocity, p.yVelocity)
    if (collisionIdx !== undefined) {
      if (sim.depositLiquid(collisionIdx, p.liquidType, SPLASH_FILL_UNIT)) {
        sim.conservationTracker.addDelta(SPLASH_FILL_UNIT)
      }
      sim.pool.release(p)
      return
    }

    p.x += p.xVelocity
    p.y += p.yVelocity
    p.yVelocity += 0.3
    sim.data.drawTile(p.x, p.y, SPLASH_COLORS[p.liquidType] ?? DEFAULT_SPLASH_COLOR)

    if (sim.outOfBounds(p)) {
      sim.pool.release(p)
    }
  },
} satisfies ParticleDef
