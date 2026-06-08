import { isMatterTankFireMode } from '../../../helpers/_helpers.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import {
  WeaponAdjustableChargeMixin,
} from '../../Input/InputController/WeaponInputControllers/mixins/WeaponAdjustableChargeMixin.ts'
import {
  WeaponFireGroupCycleMixin,
} from '../../Input/InputController/WeaponInputControllers/mixins/WeaponFireGroupCycleMixin.ts'
import { WeaponConstantInput } from '../../Input/InputController/WeaponInputControllers/WeaponConstantInput.ts'
import type { FireGroupWeapon } from '../../Input/InputController/WeaponManagerInput.ts'
import { TorchProjectile } from '../../Projectiles/TorchProjectile.ts'
import { FireMode } from '../_FireMode-types'

const WeaponAdjustableCharge = WeaponAdjustableChargeMixin(WeaponConstantInput)
const Mix = WeaponFireGroupCycleMixin(WeaponAdjustableCharge)

export class TorchWeapon extends Mix implements FireGroupWeapon {
  private projectile: TorchProjectile | null = null

  private _pos: Position = { x: 0, y: 0 }

  constructor(scene: GameLevel) {
    super(scene)
    this.addFireGroupInput()
  }

  updateFiring(value: boolean, mode: FireMode): void {
    if (value && !this.projectile) {
      let charge = this.getCharge()
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