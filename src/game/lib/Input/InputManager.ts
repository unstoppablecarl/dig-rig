import { Input } from 'phaser'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { BrushInput } from './BrushInput.ts'
import { PlayerZoomInput } from './PlayerZoomInput.ts'

export enum InputMode {
  WEAPON,
  BRUSH
}

export interface InputController {
  setInputEnabled(value: boolean): void
  enabled: boolean,
}

export class InputManager extends SceneBound {
  private allControllers: InputController[]
  private modeControllers: Record<InputMode, InputController[]>
  private _mode: InputMode

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)

    const zoomInput = new PlayerZoomInput(scene)
    const brushInput = new BrushInput(scene)
    const playerWeaponManager = scene.playerWeaponManager

    this.allControllers = [
      zoomInput,
      brushInput,
      playerWeaponManager,
    ]

    this.modeControllers = {
      [InputMode.WEAPON]: [
        zoomInput,
        playerWeaponManager,
      ],
      [InputMode.BRUSH]: [
        brushInput,
      ],
    }

    this.setMode(InputMode.WEAPON)

    // prevent default browser actions for arrow keys and space
    scene.input.keyboard!.addCapture([
      Input.Keyboard.KeyCodes.UP,
      Input.Keyboard.KeyCodes.DOWN,
      Input.Keyboard.KeyCodes.LEFT,
      Input.Keyboard.KeyCodes.RIGHT,
      Input.Keyboard.KeyCodes.SPACE,
    ])
  }

  get mode() {
    return this._mode
  }

  setMode(mode: InputMode) {
    if (this._mode === mode) return
    this._mode = mode
    this.setEnabled(this.modeControllers[mode])
  }

  private setEnabled(controllers: InputController[]) {
    for (const controller of this.allControllers) {
      const shouldEnable = controllers.includes(controller)
      controller.setInputEnabled(shouldEnable)
    }
  }

  protected onDestroy() {
    for (const controller of this.allControllers) {
      controller.setInputEnabled(false)
    }
    // @ts-expect-error: destroy
    this.allControllers = null
    // @ts-expect-error: destroy
    this.modeControllers = null
  }
}