import { FIRE_COLOR } from '../../../config/colors.ts'
import { FIRE, PERMANENT, setOwner, SOLID } from '../../Matter/_Matter.types.ts'
import { type ParticleDef } from '../_particle-types.ts'

export const CHARGED_NITRO: ParticleDef = {
  particlesToSpawn: 1,
  init(p, world) {
    const { x, y } = p
    p.color = FIRE_COLOR
    p.size = 4
    p.xVelocity = 0
    p.yVelocity = -100
    p.data.initX = x
    p.data.initY = y
    // Search upward in 3–5 row steps for a solid ceiling, matching example behaviour.
    // Defaults to -1 so the bolt travels off the top of the canvas if no ceiling exists.
    const step = 3 + Math.round(Math.random() * 2)
    p.data.minY = -1
    for (let sy = y - step; sy >= 0; sy -= step) {
      const t = world.getTileType(x, sy)
      if (t === SOLID || t === PERMANENT) {
        p.data.minY = sy
        break
      }
    }
  },
  action(p, renderer, pool, world) {
    const x2 = p.data.initX
    const y2 = Math.max(p.data.minY, p.y + p.yVelocity)
    renderer.drawThickLine(x2, p.data.initY, x2, y2, p.size, p.color)
    // Write FIRE tiles along the bolt column from initY down to the current tip
    const colX = Math.round(x2)
    for (let cy = Math.round(y2); cy <= Math.round(p.data.initY); cy++) {
      world.setTileType(colX, cy, setOwner(FIRE, p.ownerId))
    }
    p.y = y2
    if (p.y <= p.data.minY) pool.release(p)
  },
}

