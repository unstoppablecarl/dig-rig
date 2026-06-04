import { BaseProjectile } from './BaseProjectile.ts'
import { tilesToRadius } from './projectile-radius'

export class InstantProjectile extends BaseProjectile {

  setTilesToModify(count: number) {
    const changed = super.setTilesToModify(count)
    if (changed) {
      this.radius = tilesToRadius(count)
    }

    return changed
  }

  fire() {
    const charge = this.charge()
    if (this.effect.chargeMode !== null) {
      this.matterTank.addPendingCharge(this.effect.chargeMode, charge)
    }
    this.applyTiles(charge)
    this.destroy()
  }

  update() {
  }
}