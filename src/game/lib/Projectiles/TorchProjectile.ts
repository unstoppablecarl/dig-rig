import { BaseProjectile } from './BaseProjectile.ts'
import { tilesToRadius } from './projectile-radius.ts'

export class TorchProjectile extends BaseProjectile {

  setTilesToModify(count: number) {
    const changed = super.setTilesToModify(count)
    if (changed) {
      this.radius = tilesToRadius(count)
    }

    return changed
  }

  update() {
    if (!this.fired) return

    if (this.charge() > 0) {
      this.applyTiles(this.charge())
    }

    if (!this.charge()) {
      this.destroy()
    }
  }
}