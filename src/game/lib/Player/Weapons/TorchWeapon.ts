import { Scenes } from 'phaser'
import { FireMode } from '../../../config.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { PlayerWeaponTorchInput } from '../../Input/PlayerWeaponTorchInput.ts'
import { TorchProjectile } from '../../Projectiles/TorchProjectile.ts'
import type { ContinuousWeapon } from './PlayerWeaponManager.ts'
import UPDATE = Scenes.Events.UPDATE

export class TorchWeapon extends SceneBound implements ContinuousWeapon {
  private input: PlayerWeaponTorchInput
  public displayName = 'Torch'

  private projectile: TorchProjectile | null = null

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)
    this.input = new PlayerWeaponTorchInput(scene, this)

  }

  firing(value: boolean, mode: FireMode): void {
    if (value && !this.projectile) {
      const charge = this.scene.player.matterTank.chargeAvailable(mode)
      this.projectile = this.scene.projectiles.fireForPlayer(TorchProjectile, charge, mode, 0) ?? null
    }

    if (!value && this.projectile) {
      this.projectile.destroy()
      this.projectile = null
    }
  }

  get enabled() {
    return this.input.enabled
  }

  setEnabled(value: boolean) {
    this.input.setInputEnabled(value)

    if (value) {
      this.scene.events.on(UPDATE, this.update, this)
    } else {
      this.scene.events.off(UPDATE, this.update, this)
      this.projectile?.destroy()
    }
  }
  private _pos: Position = { x: 0, y: 0 }

  public update() {
    if (!this.projectile) return
    const pos = this.scene.player.getProjectilePosition(0, this._pos)
    this.projectile.x = pos.x
    this.projectile.y = pos.y
  }
}