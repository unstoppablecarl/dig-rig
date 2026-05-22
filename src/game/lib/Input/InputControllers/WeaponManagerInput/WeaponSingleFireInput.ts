import { Input } from 'phaser'
import { FireMode } from '../../../../config.ts'
import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import type { ImmediateWeapon } from '../WeaponManagerInput.ts'
import { InputController } from '../InputController.ts'
import POINTER_DOWN = Input.Events.POINTER_DOWN
import Pointer = Input.Pointer

export class WeaponSingleFireInput extends InputController {
  constructor(
    public scene: GameLevel,
    public weapon: ImmediateWeapon,
  ) {
    super(scene)
    this.bind(this.scene.input, POINTER_DOWN, this.pointerdown)
  }

  pointerdown(pointer: Pointer) {
    let mode: FireMode
    if (pointer.rightButtonDown()) {
      mode = FireMode.CREATE
    } else if (pointer.leftButtonDown()) {
      mode = FireMode.DESTROY
    } else {
      return
    }
    this.weapon.fire(mode)
  }

  protected onDestroy() {
    super.onDestroy()
    // @ts-expect-error: destroy
    this.weapon = null
  }
}
