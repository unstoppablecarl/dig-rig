import { Input, Scenes } from 'phaser'
import { FireMode } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { ContinuousWeapon } from '../Player/Weapons/PlayerWeaponManager.ts'
import type { InputController } from './InputManager.ts'
import POINTER_DOWN = Input.Events.POINTER_DOWN
import POINTER_UP = Input.Events.POINTER_UP

import Pointer = Input.Pointer
import UPDATE = Scenes.Events.UPDATE

export class PlayerWeaponConstantInput extends SceneBound<GameLevel> implements InputController {

  public mode: FireMode = FireMode.DESTROY

  private _enabled = false
  private firing = false

  constructor(
    public scene: GameLevel,
    public weapon: ContinuousWeapon,
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
      this.scene.input.on(POINTER_UP, this.pointerup, this)
      this.scene.events.on(UPDATE, this.update, this)
    } else {
      this.scene.input.off(POINTER_DOWN, this.pointerdown, this)
      this.scene.input.off(POINTER_UP, this.pointerup, this)
      this.scene.events.off(UPDATE, this.update, this)
    }

    this._enabled = value
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
    this.setInputEnabled(false)
    // @ts-expect-error: destroy
    this.weapon = null
  }
}