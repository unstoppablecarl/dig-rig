import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { InputMode } from '../_input.types.ts'
import { InputController } from './InputController.ts'

export class SetInputModeInput extends InputController {
  private prevMode: InputMode

  constructor(
    public scene: GameLevel,
    mode: InputMode,
    fallbackMode: InputMode = InputMode.WEAPON,
  ) {
    super(scene)

    const a = this.scene.playerActions
    this.binder.addInput(() => [
      a.BRUSH_MODE_TOGGLE.onDown(() => {
        const inputManager = scene.inputManager

        if (inputManager.inputMode === mode) {
          inputManager.setMode(this.prevMode ?? fallbackMode)
        } else {
          this.prevMode = inputManager.inputMode
          inputManager.setMode(mode)
        }
      }),
    ])
  }
}
