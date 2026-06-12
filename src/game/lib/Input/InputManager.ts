import { Input } from 'phaser'
import { BROWSER_DISABLED_KEYS } from '../../../input.ts'
import { ENABLE_BRUSH_MODE_DEBUG } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { InputMode } from './_input.types.ts'
import { BrushInput } from './InputController/BrushInput.ts'
import type { InputController } from './InputController/InputController.ts'
import { SetInputModeInput } from './InputController/SetInputModeInput.ts'
import { ZoomInput } from './InputController/ZoomInput.ts'
import GAMEOBJECT_POINTER_WHEEL = Input.Events.GAMEOBJECT_POINTER_WHEEL
import Pointer = Phaser.Input.Pointer

export class InputManager extends SceneBound {
  private modeControllers: Record<InputMode, InputController[]>
  private mode: InputMode

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)

    const zoomInput = new ZoomInput(scene)
    const brushInput = new BrushInput(scene)
    const playerWeaponManager = scene.playerWeaponManager

    const brushModeToggle = ENABLE_BRUSH_MODE_DEBUG
      ? [new SetInputModeInput(scene, InputMode.BRUSH)]
      : []

    this.modeControllers = {
      // order matters for mouse wheel bindings
      [InputMode.WEAPON]: [
        zoomInput,
        playerWeaponManager,
        ...brushModeToggle,
      ],
      [InputMode.BRUSH]: [
        zoomInput,
        brushInput,
        ...brushModeToggle,
      ],
    }

    scene.input.on(GAMEOBJECT_POINTER_WHEEL, this.handleMouseWheel, this)

    this.setMode(scene.uiState.inputMode)

    // prevent default browser actions
    scene.input.keyboard!.addCapture(BROWSER_DISABLED_KEYS)
  }

  private handleMouseWheel(pointer: Pointer, _objs: any, _dx: number, deltaY: number) {
    if (!this.modeControllers) return
    const event = pointer.event as WheelEvent
    // find first valid wheel input
    for (const c of this.modeControllers[this.mode]) {
      if (c.onMouseWheel?.(deltaY, event, pointer)) break
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
    const all = new Set([...Object.values(this.modeControllers).flat()])
    this.scene.input.off(GAMEOBJECT_POINTER_WHEEL, this.handleMouseWheel, this)
    for (const c of all) c.destroy()
    // @ts-expect-error: destroy
    this.modeControllers = null
  }
}
