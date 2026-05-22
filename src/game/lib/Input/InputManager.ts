import { Input } from 'phaser'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { InputController } from './InputControllers/InputController.ts'
import { BrushInput } from './InputControllers/BrushInput.ts'
import { ZoomInput } from './InputControllers/ZoomInput.ts'
import { makePlayerMovementInput, type PlayerMovementInput } from './PlayerMovementInput.ts'

export enum InputMode {
  WEAPON,
  BRUSH
}

export class InputManager extends SceneBound {
  private modeControllers: Record<InputMode, InputController[]>
  private _mode: InputMode

  readonly playerMovement: PlayerMovementInput

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)

    this.playerMovement = makePlayerMovementInput(scene)
    const zoomInput = new ZoomInput(scene)
    const brushInput = new BrushInput(scene)
    const playerWeaponManager = scene.playerWeaponManager

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
    if (this._mode !== undefined) {
      for (const c of this.modeControllers[this._mode]) c.setInputEnabled(false)
    }
    this._mode = mode
    for (const c of this.modeControllers[mode]) c.setInputEnabled(true)
  }

  protected onDestroy() {
    const all = new Set(Object.values(this.modeControllers).flat())
    for (const c of all) c.destroy()
    // @ts-expect-error: destroy
    this.modeControllers = null
  }
}
