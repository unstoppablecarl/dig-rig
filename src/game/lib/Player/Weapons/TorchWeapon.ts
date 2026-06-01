import { FireMode } from '../../../config.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import type { Weapon } from '../../Input/InputControllers/WeaponManagerInput.ts'
import { WeaponConstantInput } from '../../Input/InputControllers/WeaponManagerInput/WeaponConstantInput.ts'
import { TorchProjectile } from '../../Projectiles/TorchProjectile.ts'

export class TorchWeapon extends WeaponConstantInput implements Weapon {
  readonly displayName = 'Torch'

  private projectile: TorchProjectile | null = null

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)
  }

  private _pos: Position = { x: 0, y: 0 }

  updateFiring(value: boolean, mode: FireMode): void {
    if (value && !this.projectile) {
      const charge = this.scene.player.matterTank.chargeAvailable(mode)
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