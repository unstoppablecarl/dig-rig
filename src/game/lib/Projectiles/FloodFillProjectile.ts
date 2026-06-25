import { getCollisionSteps } from '../../helpers/_helpers.ts'
import { matterType } from '../Matter/_Matter.types.ts'
import { collidesWithCreateProjectiles } from '../Matter/matter.ts'
import { ProjectileShape } from '../MatterEngine/data/ProjectileManagerData.ts'
import { FireMode } from '../Player/_FireMode-types.ts'
import { BaseProjectile } from './BaseProjectile.ts'

// If the fill can't make any further progress after settling (e.g. it lodged against an
// excluded matter type, or the connected region is fully consumed) give up instead of
// leaking the projectile — and its matter charge reservation — forever.
const STUCK_TIMEOUT_MS = 250

export class FloodFillProjectile extends BaseProjectile {
  public shape = ProjectileShape.FLOOD_FILL

  private settled = false
  private _lastTilesModified = 0
  private _stalledMs = 0

  update(dt: number) {
    if (!this.fired) return

    this.syncTilesModified()

    if (!this.settled) {
      const { stepDx, stepDy, totalSteps } = getCollisionSteps(this.vx, this.vy, dt)

      for (let i = 0; i < totalSteps; i++) {
        const stepX = this.x + stepDx * i
        const stepY = this.y + stepDy * i

        const tile = matterType(this.scene.tilemap.getTileFromWorld(stepX, stepY))
        const collision = collidesWithCreateProjectiles(tile)

        if (collision) {
          this.settled = true

          this.renderer?.fadeOutAndDestroy()

          // stop
          this.vx = 0
          this.vy = 0

          if (this.effect.mode === FireMode.CREATE) {
            // seed from the empty tile just before the wall, so the fill grows into the cavity
            this.x = stepX - stepDx
            this.y = stepY - stepDy
          } else {
            // seed from the solid tile itself, so the fill can chew into the vein it hit
            this.x = stepX
            this.y = stepY
          }

          this.sync(this.charge())

          break
        }
      }

      this.x += this.vx * dt
      this.y += this.vy * dt
    } else if (this.tilesModified === this._lastTilesModified) {
      this._stalledMs += dt * 1000
      if (this._stalledMs > STUCK_TIMEOUT_MS) {
        this.destroy()
        return
      }
    } else {
      this._lastTilesModified = this.tilesModified
      this._stalledMs = 0
    }
    this.updateEnd()
  }
}
