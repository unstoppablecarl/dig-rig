import { FireMode } from '../Player/_FireMode-types'
import { BaseProjectile } from './BaseProjectile.ts'

export class TorchProjectile extends BaseProjectile {

  radius = 20

  update() {
    if (!this.fired) return

    if (this.charge() > 0) {
      if (this.mode === FireMode.CREATE) {
        this.createTiles(this.charge())
      } else if (this.mode === FireMode.DESTROY) {
        this.destroyTiles(this.charge())
      }
    }

    if (!this.charge()) {
      this.destroy()
    }
  }
}