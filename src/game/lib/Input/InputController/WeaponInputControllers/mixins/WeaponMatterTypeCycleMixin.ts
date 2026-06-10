import type { AbstractMixinConstructor } from '../../../../../helpers/class-mixins.ts'
import type { MatterType } from '../../../../Matter/_Matter-types.ts'
import type { InputController } from '../../InputController.ts'

export function WeaponMatterTypeCycleMixin<TBase extends AbstractMixinConstructor<InputController>>(Base: TBase) {
  abstract class WeaponMatterTypeCycle extends Base {
    addMatterTypeInput() {
      const a = this.scene.playerActions
      this.binder.addInput(() => [
        a.PREV_MATTER_TYPE.onDown(() => {
          this.scene.weaponUIState.prevMatterType()
        }),
        a.NEXT_MATTER_TYPE.onDown(() => {
          this.scene.weaponUIState.nextMatterType()
        }),
      ])
    }

    getMatterType(): MatterType {
      return this.scene.weaponUIState.matterType
    }
  }

  return WeaponMatterTypeCycle
}