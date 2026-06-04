import { BaseProjectile } from './BaseProjectile.ts'

export class TorchProjectile extends BaseProjectile {

  radius = 20

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