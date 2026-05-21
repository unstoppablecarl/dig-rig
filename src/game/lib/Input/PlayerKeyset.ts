import { Input } from 'phaser'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { InputController } from './InputManager.ts'
import ANY_KEY_DOWN = Input.Keyboard.Events.ANY_KEY_DOWN

type Bindings = Record<string, () => void>

export class PlayerKeyset extends SceneBound<GameLevel> implements InputController {
  private _enabled = false

  constructor(
    scene: GameLevel,
    private bindings: Bindings,
  ) {
    super(scene)
  }

  get enabled() {
    return this._enabled
  }

  setInputEnabled(value: boolean): void {
    if (this._enabled === value) return

    this._enabled = value

    if (value) {
      this.scene.input.keyboard!.on(ANY_KEY_DOWN, this.keydown, this)
    } else {
      this.scene.input.keyboard!.off(ANY_KEY_DOWN, this.keydown, this)
    }
  }

  keydown(event: KeyboardEvent) {
    this.bindings[event.key]?.()
  }

  protected onDestroy() {
    this.setInputEnabled(false)
  }
}