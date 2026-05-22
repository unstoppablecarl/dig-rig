import { Input, Scenes } from 'phaser'
import { FireMode } from '../../../../config.ts'
import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import { InputController } from '../InputController.ts'
import type { Weapon } from '../WeaponManagerInput.ts'
import POINTER_DOWN = Input.Events.POINTER_DOWN
import POINTER_UP = Input.Events.POINTER_UP
import Pointer = Input.Pointer
import UPDATE = Scenes.Events.UPDATE

export interface ContinuousWeapon extends Weapon {
  firing(value: boolean, mode: FireMode): void,
}

export class WeaponConstantInput extends InputController {
  public mode: FireMode = FireMode.DESTROY
  private firing = false

  constructor(
    public scene: GameLevel,
    public weapon: ContinuousWeapon,
  ) {
    super(scene)
    this.bind(this.scene.input, POINTER_DOWN, this.pointerdown)
    this.bind(this.scene.input, POINTER_UP, this.pointerup)
    this.bind(this.scene.events, UPDATE, this.update)
  }

  pointerdown(pointer: Pointer) {
    if (pointer.rightButtonDown()) {
      this.firing = true
      this.mode = FireMode.CREATE
    }

    if (pointer.leftButtonDown()) {
      this.firing = true
      this.mode = FireMode.DESTROY
    }
  }

  pointerup(pointer: Pointer) {
    if (pointer.rightButtonReleased() || pointer.leftButtonReleased()) {
      this.firing = false
    }
  }

  update(_time: number, _delta: number) {
    this.weapon.firing(this.firing, this.mode)
  }

  protected onDestroy() {
    super.onDestroy()
    // @ts-expect-error: destroy
    this.weapon = null
  }
}
