import { randomRangeInt } from '../../../helpers/random.ts'
import { FIRE, setOwner, SOLID } from '../../Matter/_Matter.types.ts'
import { isDestructible } from '../../Matter/matter.ts'
import { type ParticleDef } from '../_particle-types.ts'

export const THERMITE_SPARK: ParticleDef = {
  particlesToSpawn: 1,
  init(p, world) {
    const { x, y } = p
    p.size = 4
    p.xVelocity = 0
    p.yVelocity = -100
    p.initX = x
    p.initY = y
    // Search upward in 3–5 row steps for a solid ceiling, matching example behaviour.
    // Defaults to -1 so the bolt travels off the top of the canvas if no ceiling exists.
    const step = randomRangeInt(3, 5)
    p.minY = -1
    for (let sy = y - step; sy >= 0; sy -= step) {
      const t = world.getTileType(x, sy)
      if (t === SOLID || !isDestructible(t)) {
        p.minY = sy
        break
      }
    }
  },
  action(p, sim) {
    const x2 = p.initX
    const y2 = Math.max(p.minY, p.y + p.yVelocity)
    const fire = setOwner(FIRE, p.ownerId)
    sim.fillLine(x2, p.initY, x2, y2, p.size, fire)

    p.y = y2
    if (p.y <= p.minY) {
      sim.pool.release(p)
    }
  },
}

