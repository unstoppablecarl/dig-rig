import { Input } from 'phaser'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { InputController } from './InputController.ts'
import GAMEOBJECT_POINTER_WHEEL = Input.Events.GAMEOBJECT_POINTER_WHEEL

export class ZoomInput extends InputController {
  constructor(scene: GameLevel) {
    super(scene)
    this.bind(this.scene.input, GAMEOBJECT_POINTER_WHEEL, this.wheel)
  }

  wheel(_pointer: any, _gameObjects: any, _deltaX: number, deltaY: number) {
    this.scene.cameraController.adjustZoom(deltaY * 0.001)
  }
}
