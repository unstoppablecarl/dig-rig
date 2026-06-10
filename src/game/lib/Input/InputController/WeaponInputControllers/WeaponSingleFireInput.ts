import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import { FireMode } from '../../../Player/_FireMode-types'
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
      a.FIRE_PRIMARY.onDown(() => this.fire(this.scene.weaponUIState.fireGroupPrimary)),
      a.FIRE_SECONDARY.onDown(() => this.fire(this.scene.weaponUIState.fireGroupSecondary)),
    ])
  }

  setEnabled(value: boolean) {
    this.setInputEnabled(value)
    this.scene.previewProjectileRenderer.setVisible(value)
  }

  abstract fire(mode: FireMode): void
}
