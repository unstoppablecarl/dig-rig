import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import type { ProjectileEffect } from '../../../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import { InputController } from '../InputController.ts'
import { WeaponAdjustableChargeMixin } from './mixins/WeaponAdjustableChargeMixin.ts'
import { WeaponFireGroupCycleMixin } from './mixins/WeaponFireGroupCycleMixin.ts'
import { WeaponMatterTypeCycleMixin } from './mixins/WeaponMatterTypeCycleMixin.ts'

const MixA = WeaponAdjustableChargeMixin(InputController)
const MixB = WeaponMatterTypeCycleMixin(MixA)
const Mix = WeaponFireGroupCycleMixin(MixB)

export abstract class WeaponSingleFireInput extends Mix {

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    this.addChargeInput()
    this.addFireGroupInput()
    this.addMatterTypeInput()

    const a = this.scene.playerActions
    this.binder.addInput(() => [
      a.FIRE_PRIMARY.onDown(() => this.fire(this.scene.weaponUIState.fireGroupPrimaryEffect)),
      a.FIRE_SECONDARY.onDown(() => this.fire(this.scene.weaponUIState.fireGroupSecondaryEffect)),
    ])
  }

  setEnabled(value: boolean) {
    this.setInputEnabled(value)
    this.scene.previewProjectileRenderer.setVisible(value)
  }

  abstract fire(effect: ProjectileEffect): void
}
