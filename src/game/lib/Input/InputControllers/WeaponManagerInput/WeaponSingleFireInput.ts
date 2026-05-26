import { FireMode } from '../../../../config.ts'
import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import { InputController } from '../InputController.ts'
import type { ImmediateWeapon } from '../WeaponManagerInput.ts'

export class WeaponSingleFireInput extends InputController {

  constructor(
    public scene: GameLevel,
    public weapon: ImmediateWeapon,
  ) {
    super(scene)
    const actions = this.scene.playerActions
    this.addInput(() => [
      actions.FIRE_PRIMARY.onDown(() => this.weapon.fire(FireMode.DESTROY)),
      actions.FIRE_SECONDARY.onDown(() => this.weapon.fire(FireMode.CREATE)),
    ])
  }

  protected onDestroy() {
    super.onDestroy()
    // @ts-expect-error: destroy
    this.weapon = null
  }
}
