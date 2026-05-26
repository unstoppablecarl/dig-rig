import { Scenes } from 'phaser'
import { FireMode } from '../../../../config.ts'
import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import { InputController } from '../InputController.ts'
import type { ImmediateWeapon } from '../WeaponManagerInput.ts'
import UPDATE = Scenes.Events.UPDATE

export class WeaponRapidFireInput extends InputController {
  protected coolDown = 0

  constructor(
    public scene: GameLevel,
    public weapon: ImmediateWeapon,
    readonly rateOfFireMs: number,
  ) {
    super(scene)
    this.bind(this.scene.events, UPDATE, this.update)
  }

  update(_time: number, delta: number) {
    this.coolDown -= delta

    if (this.coolDown > 0) return

    const pointer = this.scene.input.activePointer

    let mode: FireMode
    if (pointer.rightButtonDown()) {
      mode = FireMode.CREATE
    } else if (pointer.leftButtonDown()) {
      mode = FireMode.DESTROY
    } else {
      this.coolDown = 0
      return
    }

    this.coolDown += this.rateOfFireMs
    this.weapon.fire(mode)
  }

  protected onDestroy() {
    super.onDestroy()
    // @ts-expect-error: destroy
    this.weapon = null
  }
}
