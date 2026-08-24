import { Math as PMath } from 'phaser'
import { HALF_PI } from '../../../helpers/_helpers.ts'
import { colorToPixelRGBA, rgbaToColor } from '../../../helpers/color-converters.ts'
import { randomRange } from '../../../helpers/random.ts'
import { ACID, CRYO, LAVA, NAPALM, OIL, SALT_WATER, WATER } from '../../Matter/_Matter.types.ts'
import type { LiquidTypes } from '../../Matter/matter.ts'
import { type ParticleDef } from '../_particle-types.ts'
import DegToRad = PMath.DegToRad

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

// Each spawned particle carries SPLASH_FILL_UNIT fill, debited from the source tile in
// total (count * unit) when the splash is spawned and credited back here on landing —
// keeps the droplet's mass conserved instead of conjuring a full FILL_MAX tile out of thin air.
const SPLASH_FILL_UNIT = 1
const SPLASH_PARTICLE_COUNT = 5
const SPLASH_TOTAL_FILL = SPLASH_PARTICLE_COUNT * SPLASH_FILL_UNIT
// Scales the body's raw per-step (vx, vy) into a launch speed — bumped up from the old 0.1
// (which made `speed` too small for the cone lean below to be visible) so the spray still
// visibly depends on how hard the body hit the liquid.
const SPLASH_VELOCITY_MULTIPLIER = 0.5
const STRAIGHT_UP = -HALF_PI

// Angle: each droplet leans 0..this many degrees off straight-up, toward whichever side the
// body was moving (bow-wave asymmetry). 0 = every droplet flies straight up in a line; higher
// = wider splash fan.
const SPLASH_ANGLE_VARIANCE_DEG = 30
const SPLASH_SPEED_VARIANCE_MIN = 0.7
const SPLASH_SPEED_VARIANCE_MAX = 1.8

export const LIQUID_SPLASH = {
  // type is the liquid being displaced; vx/vy are the source body's raw per-step velocity.
  spawn(pool, sim, particleType, x, y, ownerId, vx, vy, value) {
    const tx = Math.floor(x)
    const ty = Math.floor(y)
    const idx = ty * sim.width + tx

    if (sim.fill[idx] <= SPLASH_TOTAL_FILL) return

    const speed = Math.hypot(vx!, vy!) * SPLASH_VELOCITY_MULTIPLIER
    // Which side to lean the spray cone toward (bow-wave asymmetry) — falls back to a random
    // side when the body has no horizontal motion (e.g. falling straight down), since there's
    // no meaningful "side" to lean toward in that case.
    const lean = vx! !== 0 ? Math.sign(vx!) : (Math.random() < 0.5 ? -1 : 1)

    // Each particle credits SPLASH_FILL_UNIT back on landing (see action()), and
    // SPLASH_TOTAL_FILL above is exactly count * unit, so spawning fewer than
    // SPLASH_PARTICLE_COUNT droplets here would destroy fill instead of conserving it.
    for (let i = 0; i < SPLASH_PARTICLE_COUNT; i++) {
      const p = pool.acquire(particleType, x, y, ownerId)
      if (!p) break

      sim.fill[idx] -= SPLASH_FILL_UNIT
      sim.conservationTracker.addDelta(-SPLASH_FILL_UNIT)

      p.liquidType = value!

      const angleVariance = randomRange(0, DegToRad(SPLASH_ANGLE_VARIANCE_DEG))
      const away = STRAIGHT_UP + lean * angleVariance
      const speedVariance = randomRange(SPLASH_SPEED_VARIANCE_MIN, SPLASH_SPEED_VARIANCE_MAX)
      p.setVelocity(speed * speedVariance, away)
      p.size = 1
    }
  },
  action(p, sim) {
    if (sim.doLiquidCollision(p.x, p.y, p.xVelocity, p.yVelocity, p.liquidType, SPLASH_FILL_UNIT)) {
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
