import { Scenes } from 'phaser'
import { FireMode } from '../../../config.ts'
import { isMatterTankFireMode } from '../../../helpers/_helpers.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import {
  type ContinuousWeapon,
  WeaponConstantInput,
} from '../../Input/InputControllers/WeaponManagerInput/WeaponConstantInput.ts'
import { TorchProjectile } from '../../Projectiles/TorchProjectile.ts'
import { EventsBinder } from '../../Util/EventsBinder.ts'
import UPDATE = Scenes.Events.UPDATE

export class TorchWeapon extends SceneBound implements ContinuousWeapon {
  readonly displayName = 'Torch'

  private input: WeaponConstantInput

  private projectile: TorchProjectile | null = null
  private binder: EventsBinder

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)
    this.input = new WeaponConstantInput(scene, this)
    this.binder = new EventsBinder()
    this.binder.add(scene.events, UPDATE, this.update, this)
  }

  firing(value: boolean, mode: FireMode): void {
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
  }

  get enabled() {
    return this.input.enabled
  }

  setEnabled(value: boolean) {
    this.input.setInputEnabled(value)

    if (value) {
      this.binder.bind()
    } else {
      this.binder.unBind()
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

  protected onDestroy() {
    this.input.destroy()
    this.projectile?.destroy()
    this.projectile = null

    this.binder.unBind()
    // @ts-expect-error: destroy
    this.binder = null
    this.scene.events.off(UPDATE, this.update, this)
  }
}