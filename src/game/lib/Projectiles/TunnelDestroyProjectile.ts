import { FireMode } from '../../config.ts'
import { BaseProjectile } from './BaseProjectile.ts'
import { radiusToTiles } from './projectile-radius'

const MAX_RADIUS = 20

export class TunnelDestroyProjectile extends BaseProjectile {
  readonly mode = FireMode.DESTROY as const

  static MAX_TILES_TO_MOD = radiusToTiles(MAX_RADIUS)
  active = false
  fired = true
  radius = 20

  setTilesToModify(): boolean {
    return false
  }

  recharge() {
    const available = this.matterTank.chargeAvailable(FireMode.DESTROY)
    if (available < TunnelDestroyProjectile.MAX_TILES_TO_MOD) return
    this.tilesModified = 0

    this.tilesToModify = available
    this.matterTank.addPendingCharge(FireMode.DESTROY, this.tilesToModify)
  }

  fire() {
    this.recharge()
  }

  update() {
    this.renderer?.setVisible(this.active)
    if (!this.active) return

    const charge = this.charge()
    if (charge > 0) {
      this.destroyTiles(charge)
    } else {
      this.recharge()
    }
  }
}