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
import { tilesToRadius } from '../../Projectiles/projectile-radius.ts'
import type { ProjectileEffect } from '../../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import { TorchProjectile } from '../../Projectiles/TorchProjectile.ts'

const WeaponAdjustableCharge = WeaponAdjustableChargeMixin(WeaponConstantInput)
const Mix = WeaponFireGroupCycleMixin(WeaponAdjustableCharge)

export class TorchWeapon extends Mix implements FireGroupWeapon {
  private projectile: TorchProjectile | null = null

  private _pos: Position = { x: 0, y: 0 }

  constructor(scene: GameLevel) {
    super(scene)
    this.addFireGroupInput()
    this.addChargeInput()
  }

  updateFiring(value: boolean, effect: ProjectileEffect): void {
    if (value && !this.projectile) {
      let charge = Infinity
      if (isMatterTankFireMode(effect.mode)) {
        charge = this.scene.player.matterTank.chargeAvailable(effect.mode)
      }
      this.projectile = this.scene.projectiles.fireForPlayer(TorchProjectile, charge, effect, 0) ?? null
    }

    if (!value && this.projectile) {
      this.projectile.destroy()
      this.projectile = null
    }

    if (!this.projectile) return
    const pos = this.scene.player.getProjectilePosition(0, this._pos)
    this.projectile.x = pos.x
    this.projectile.y = pos.y

    this.projectile.radius = tilesToRadius(this.getCharge())
  }

  _startPos: Position = { x: 0, y: 0 }

  update(_time: number, delta: number) {
    super.update(_time, delta)

    const player = this.scene.player
    const startPos = player.getProjectilePosition(0, this._startPos)

    this.scene.previewProjectileRenderer.setPosition(startPos)
  }

  setEnabled(value: boolean) {
    super.setEnabled(value)
    this.scene.previewProjectileRenderer.setVisible(value)
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