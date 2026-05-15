import { Input } from 'phaser'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { InputController } from './InputManager.ts'
import GAMEOBJECT_POINTER_WHEEL = Input.Events.GAMEOBJECT_POINTER_WHEEL

export class PlayerZoomInput extends SceneBound<GameLevel> implements InputController {
  private _enabled = false

  get enabled() {
    return this._enabled
  }

  setInputEnabled(value: boolean) {
    if (this._enabled === value) return

    if (value) {
      this.scene.input.on(GAMEOBJECT_POINTER_WHEEL, this.wheel, this)
    } else {
      this.scene.input.off(GAMEOBJECT_POINTER_WHEEL, this.wheel, this)
    }
    this._enabled = value
  }

  wheel(_pointer: any, _gameObjects: any, _deltaX: number, deltaY: number) {
    this.scene.cameraController.adjustZoom(deltaY * 0.001)
  }

  protected onDestroy() {
    this.setInputEnabled(false)
  }
}