import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { InputMode } from '../_input.types.ts'
import type { PlayerAction } from '../PlayerActions.ts'
import { InputController } from './InputController.ts'

export class ToggleInputModeController extends InputController {
  constructor(
    public scene: GameLevel,
    playerAction: PlayerAction,
    mode: InputMode,
    fallbackMode: InputMode = InputMode.WEAPON,
  ) {
    super(scene)

    const a = this.scene.playerActions
    this.binder.addInput(() => [
      a[playerAction].onDown(() => {
        const inputManager = scene.inputManager

        if (inputManager.inputMode === mode) {
          inputManager.setMode(fallbackMode)
        } else {
          inputManager.setMode(mode)
        }
      }),
    ])
  }
}
