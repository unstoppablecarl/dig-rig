import { Input } from 'phaser'
import { FireMode } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { ImmediateWeapon } from '../Player/Weapons/PlayerWeaponManager.ts'
import type { InputController } from './InputManager.ts'
import POINTER_DOWN = Input.Events.POINTER_DOWN

import Pointer = Input.Pointer

export class PlayerWeaponSingleFireInput extends SceneBound<GameLevel> implements InputController {
  private _enabled = false

  constructor(
    public scene: GameLevel,
    public weapon: ImmediateWeapon,
  ) {
    super(scene)
  }

  get enabled() {
    return this._enabled
  }

  setInputEnabled(value: boolean) {
    if (this._enabled === value) return

    if (value) {
      this.scene.input.on(POINTER_DOWN, this.pointerdown, this)
    } else {
      this.scene.input.off(POINTER_DOWN, this.pointerdown, this)
    }

    this._enabled = value
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

  destroy() {
    this.setInputEnabled(false)

    // @ts-expect-error: destroy
    this.weapon = null
    super.destroy()
  }
}