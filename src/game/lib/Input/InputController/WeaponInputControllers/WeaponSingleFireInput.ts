import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import { FireMode } from '../../../Player/_FireMode-types'
import { InputController } from '../InputController.ts'
import { WeaponAdjustableChargeMixin } from './mixins/WeaponAdjustableChargeMixin.ts'
import { WeaponFireGroupCycleMixin } from './mixins/WeaponFireGroupCycleMixin.ts'

const WeaponAdjustableCharge = WeaponAdjustableChargeMixin(InputController)
const Mix = WeaponFireGroupCycleMixin(WeaponAdjustableCharge)

export abstract class WeaponSingleFireInput extends Mix {

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    this.addChargeInput()
    this.addFireGroupInput()
    const a = this.scene.playerActions
    this.addInput(() => [
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
