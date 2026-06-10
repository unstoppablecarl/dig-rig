import { Scenes } from 'phaser'
import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import type { ProjectileEffect } from '../../../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import { PROJECTILE_EFFECT } from '../../../Projectiles/ProjectileEffect/ProjectileEffect.ts'
import { InputController } from '../InputController.ts'
import UPDATE = Scenes.Events.UPDATE

export abstract class WeaponConstantInput extends InputController {
  public effect: ProjectileEffect = PROJECTILE_EFFECT.DESTROY
  private firing = false

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    this.binderAdd(this.scene.events, UPDATE, this.update)

    const a = this.scene.playerActions
    this.binder.addInput(() => [
      a.FIRE_PRIMARY.onDown(() => {
        this.firing = true
        this.effect = this.scene.weaponUIState.fireGroupPrimaryEffect
      }),
      a.FIRE_SECONDARY.onDown(() => {
        this.firing = true
        this.effect = this.scene.weaponUIState.fireGroupSecondaryEffect
      }),
      a.FIRE_PRIMARY.onUp(() => {
        this.firing = false
      }),
      a.FIRE_SECONDARY.onUp(() => {
        this.firing = false
      }),
    ])
  }

  setEnabled(value: boolean) {
    this.setInputEnabled(value)
  }

  protected onDisable() {
    this.firing = false
  }

  abstract updateFiring(value: boolean, effect: ProjectileEffect): void

  update(_time: number, _delta: number) {
    this.updateFiring(this.firing, this.effect)
  }
}
