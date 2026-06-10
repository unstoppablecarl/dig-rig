import { isMatterTankFireMode } from '../../../../../helpers/_helpers.ts'
import type { AbstractMixinConstructor } from '../../../../../helpers/class-mixins.ts'
import type { GameLevel } from '../../../../../scenes/GameLevel.ts'
import { GameEvent } from '../../../../events.ts'
import type { ProjectileEffect } from '../../../../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import type { InputController } from '../../InputController.ts'

export function WeaponAdjustableChargeMixin<TBase extends AbstractMixinConstructor<InputController>>(Base: TBase) {
  abstract class WeaponAdjustableCharge extends Base {
    abstract scene: GameLevel
    readonly MIN_CHARGE = 10

    onMouseWheel(deltaY: number): boolean {
      this.adjustCharge(Math.round(deltaY * -10))
      return true
    }

    protected addChargeInput() {
      const a = this.scene.playerActions
      this.binder.addInputHoldRepeat(a.CHARGE_DECREASE, () => this.adjustCharge(-100))
      this.binder.addInputHoldRepeat(a.CHARGE_INCREASE, () => this.adjustCharge(100))
    }

    protected adjustCharge(value: number): void {
      const changed = this.setCharge(this.getCharge() + value)
      if (value > 0 && !changed) {
        this.scene.EVENTS.emit(GameEvent.MESSAGE, 'Max Available in Matter Tank')
      }
    }

    getCharge(): number {
      return this.scene.weaponUIState.charge
    }

    protected setCharge(val: number): boolean {
      val = Math.max(this.MIN_CHARGE, val)
      const changed = val !== this.getCharge()
      if (changed) {
        this.scene.weaponUIState.charge = val
        return true
      }
      return false
    }

    protected clampCharge(effect: ProjectileEffect) {
      const charge = this.getCharge()
      if (isMatterTankFireMode(effect.mode)) {
        return this.scene.player.matterTank.clampToChargeAvailable(charge, effect.mode)
      }
      return charge
    }
  }

  return WeaponAdjustableCharge
}