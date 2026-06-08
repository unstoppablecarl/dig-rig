import type { AbstractMixinConstructor } from '../../../../../helpers/class-mixins.ts'
import type { FireGroup } from '../../../../Player/_FireMode-types.ts'
import type { InputController } from '../../InputController.ts'

export function WeaponFireGroupCycleMixin<TBase extends AbstractMixinConstructor<InputController>>(Base: TBase) {
  abstract class WeaponFireGroupCycle extends Base {
    addFireGroupInput() {
      const a = this.scene.playerActions
      this.addInput(() => [
        a.PREV_MODE.onDown(() => {
          this.scene.weaponUIState.prevFireGroup()
        }),
        a.NEXT_MODE.onDown(() => {
          this.scene.weaponUIState.nextFireGroup()
        }),
      ])
    }

    getFireGroup(): FireGroup {
      return this.scene.weaponUIState.fireGroup
    }
  }

  return WeaponFireGroupCycle
}