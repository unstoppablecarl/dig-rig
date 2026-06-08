import { Input } from 'phaser'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { InputMode } from './_input.types.ts'
import { BrushInput } from './InputController/BrushInput.ts'
import type { InputController } from './InputController/InputController.ts'
import { ZoomInput } from './InputController/ZoomInput.ts'
import GAMEOBJECT_POINTER_WHEEL = Input.Events.GAMEOBJECT_POINTER_WHEEL

export class InputManager extends SceneBound {
  private modeControllers: Record<InputMode, InputController[]>
  private readonly zoomInput: ZoomInput
  private mode: InputMode
  brushInput: BrushInput

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)

    this.zoomInput = new ZoomInput(scene)
    const brushInput = this.brushInput = new BrushInput(scene)
    const playerWeaponManager = scene.playerWeaponManager

    this.modeControllers = {
      [InputMode.WEAPON]: [
        playerWeaponManager,
      ],
      [InputMode.BRUSH]: [
        brushInput,
      ],
    }

    scene.input.on(GAMEOBJECT_POINTER_WHEEL, this.handleMouseWheel, this)

    this.setMode(scene.uiState.inputMode)

    // prevent default browser actions for arrow keys and space
    scene.input.keyboard!.addCapture([
      Input.Keyboard.KeyCodes.UP,
      Input.Keyboard.KeyCodes.DOWN,
      Input.Keyboard.KeyCodes.LEFT,
      Input.Keyboard.KeyCodes.RIGHT,
      Input.Keyboard.KeyCodes.SPACE,
    ])
  }

  private handleMouseWheel(_ptr: any, _objs: any, _dx: number, deltaY: number) {
    if (!this.modeControllers) return
    // valid zoom wheel input
    if (this.zoomInput.onMouseWheel(deltaY)) return
    // find first valid wheel input
    for (const c of this.modeControllers[this.mode]) {
      if (c.onMouseWheel?.(deltaY)) break
    }
  }

  get inputMode() {
    return this.mode
  }

  setMode(mode: InputMode) {
    if (this.mode === mode) return
    if (this.mode !== undefined) {
      for (const c of this.modeControllers[this.mode]) c.setInputEnabled(false)
    }
    this.mode = mode
    for (const c of this.modeControllers[mode]) c.setInputEnabled(true)
    this.scene.uiState.inputMode = this.mode
  }

  protected onDestroy() {
    const all = new Set([this.zoomInput, ...Object.values(this.modeControllers).flat()])
    this.scene.input.off(GAMEOBJECT_POINTER_WHEEL, this.handleMouseWheel, this)
    for (const c of all) c.destroy()
    // @ts-expect-error: destroy
    this.modeControllers = null
  }
}
