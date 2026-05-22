import { Input } from 'phaser'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { InputController } from './InputController.ts'
import ANY_KEY_DOWN = Input.Keyboard.Events.ANY_KEY_DOWN

type Bindings = Record<string, () => void>

export class KeysetInput extends InputController {
  constructor(
    scene: GameLevel,
    private bindings: Bindings,
  ) {
    super(scene)
    this.bind(this.scene.input.keyboard!, ANY_KEY_DOWN, this.keydown)
  }

  keydown(event: KeyboardEvent) {
    this.bindings[event.key]?.()
  }
}
