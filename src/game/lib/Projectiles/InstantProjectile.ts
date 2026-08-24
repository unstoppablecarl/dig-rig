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
    this.sync(this.charge())
  }

  protected onTilesModified() {
    this.destroy()
  }

  update() {
  }
}