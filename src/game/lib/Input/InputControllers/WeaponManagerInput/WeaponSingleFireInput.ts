import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import { InputController } from '../InputController.ts'
import type { ImmediateWeapon } from '../WeaponManagerInput.ts'

export class WeaponSingleFireInput extends InputController {

  constructor(
    public scene: GameLevel,
    weapon: ImmediateWeapon,
  ) {
    super(scene)
    const a = this.scene.playerActions
    this.addInput(() => [
      a.FIRE_PRIMARY.onDown(() => weapon.fire(this.scene.playerWeaponManager.fireGroup.primary())),
      a.FIRE_SECONDARY.onDown(() => weapon.fire(this.scene.playerWeaponManager.fireGroup.secondary())),
    ])
  }
}
