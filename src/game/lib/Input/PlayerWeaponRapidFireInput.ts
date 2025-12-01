import type { GameLevel } from '../../scenes/GameLevel.ts'
import { FireMode } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { InputController } from './InputManager.ts'
import type { ImmediateWeapon } from '../Player/Weapons/PlayerWeaponManager.ts'
import UPDATE = Phaser.Scenes.Events.UPDATE

export class PlayerWeaponRapidFireInput extends SceneBound<GameLevel> implements InputController {
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
      this.scene.events.on(UPDATE, this.update, this)
    } else {
      this.scene.events.off(UPDATE, this.update, this)
    }

    this._enabled = value
  }

  update() {
    const pointer = this.scene.input.activePointer

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