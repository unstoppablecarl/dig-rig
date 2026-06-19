import { isMatterTankFireMode } from '../../helpers/_helpers.ts'
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
    if (isMatterTankFireMode(this.effect.mode)) {
      this.matterTank.addPendingCharge(this.effect.mode, charge)
    }
     this.applyTiles(charge)
  }

  protected onApplyTilesResult() {
    this.destroy()
  }

  update() {
  }
}