import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { InputController } from './InputController.ts'

export class FireGroupInput extends InputController {

  constructor(scene: GameLevel) {
    super(scene)

    const a = this.scene.playerActions
    this.addInput(() => [
      a.PREV_FIRE_MODE.onDown(() => {
        scene.weaponUIState.prevFireGroup()
      }),
      a.NEXT_FIRE_MODE.onDown(() => {
        scene.weaponUIState.nextFireGroup()
      }),
    ])
  }
}