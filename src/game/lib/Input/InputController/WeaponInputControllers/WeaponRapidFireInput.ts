import { Scenes } from 'phaser'
import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import { FireMode } from '../../../Player/_FireMode-types'
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

    let mode: FireMode
    if (a.FIRE_SECONDARY.isDown()) {
      mode = this.scene.weaponUIState.fireGroupSecondary
    } else if (a.FIRE_PRIMARY.isDown()) {
      mode = this.scene.weaponUIState.fireGroupPrimary
    } else {
      this.coolDown = 0
      return
    }

    this.coolDown += this.rateOfFireMs
    this.fire(mode)
  }

  setEnabled(value: boolean) {
    this.setInputEnabled(value)
  }

  abstract fire(mode: FireMode): void

  protected onDestroy() {
    super.onDestroy()
  }
}
