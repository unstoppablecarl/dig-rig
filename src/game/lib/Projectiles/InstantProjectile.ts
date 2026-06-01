import { FireMode } from '../../config.ts'
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
    this.matterTank.addPendingCharge(this.mode, charge)
    if (this.mode === FireMode.DESTROY) {
      this.destroyTiles(charge)
    } else if (this.mode === FireMode.CREATE) {
      this.createTiles(charge)
    }
    this.destroy()
  }

  update() {
  }
}