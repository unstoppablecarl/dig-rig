import { Scenes } from 'phaser'
import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import type { ProjectileEffect } from '../../../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import { InputController } from '../InputController.ts'
import { WeaponAdjustableChargeMixin } from './mixins/WeaponAdjustableChargeMixin.ts'
import { WeaponFireGroupCycleMixin } from './mixins/WeaponFireGroupCycleMixin.ts'
import { WeaponMatterTypeCycleMixin } from './mixins/WeaponMatterTypeCycleMixin.ts'
import UPDATE = Scenes.Events.UPDATE

const MixA = WeaponAdjustableChargeMixin(InputController)
const MixB = WeaponMatterTypeCycleMixin(MixA)
const Mix = WeaponFireGroupCycleMixin(MixB)

export abstract class WeaponRapidFireInput extends Mix {
  protected coolDown = 0
  abstract readonly rateOfFireMs: number

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    this.binderAdd(this.scene.events, UPDATE, this.update)
    this.addChargeInput()
    this.addFireGroupInput()
    this.addMatterTypeInput()
  }

  update(_time: number, delta: number) {
    this.coolDown -= delta

    if (this.coolDown > 0) return

    const a = this.scene.playerActions

    let effect: ProjectileEffect
    if (a.FIRE_SECONDARY.isDown()) {
      effect = this.scene.weaponUIState.fireGroupSecondaryEffect
    } else if (a.FIRE_PRIMARY.isDown()) {
      effect = this.scene.weaponUIState.fireGroupPrimaryEffect
    } else {
      this.coolDown = 0
      return
    }

    this.coolDown += this.rateOfFireMs
    this.fire(effect)
  }

  setEnabled(value: boolean) {
    this.setInputEnabled(value)
  }

  abstract fire(effect: ProjectileEffect): void
}
