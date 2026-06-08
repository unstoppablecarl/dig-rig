import { isMatterTankFireMode } from '../../../helpers/_helpers.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import type { Weapon } from '../../Input/InputController/WeaponManagerInput.ts'
import { addFireGroupInput } from '../../Input/InputController/WeaponManagerInput/_helpers.ts'
import { WeaponConstantInput } from '../../Input/InputController/WeaponManagerInput/WeaponConstantInput.ts'
import { TorchProjectile } from '../../Projectiles/TorchProjectile.ts'
import { FireMode } from '../_FireMode-types'

export class TorchWeapon extends WeaponConstantInput implements Weapon {
  private projectile: TorchProjectile | null = null

  private _pos: Position = { x: 0, y: 0 }

  constructor(scene: GameLevel) {
    super(scene)
    addFireGroupInput(this)
  }

  updateFiring(value: boolean, mode: FireMode): void {
    if (value && !this.projectile) {
      let charge = Infinity
      if (isMatterTankFireMode(mode)) {
        charge = this.scene.player.matterTank.chargeAvailable(mode)
      }
      this.projectile = this.scene.projectiles.fireForPlayer(TorchProjectile, charge, mode, 0) ?? null
    }

    if (!value && this.projectile) {
      this.projectile.destroy()
      this.projectile = null
    }

    if (!this.projectile) return
    const pos = this.scene.player.getProjectilePosition(0, this._pos)
    this.projectile.x = pos.x
    this.projectile.y = pos.y
  }

  protected onDisable() {
    super.onDisable()
    this.projectile?.destroy()
  }

  protected onDestroy() {
    super.onDestroy()
    this.projectile?.destroy()
    this.projectile = null
  }
}