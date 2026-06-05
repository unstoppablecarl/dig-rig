import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { InputController } from './InputController.ts'

export class FireGroupInput extends InputController {

  constructor(scene: GameLevel) {
    super(scene)

    const a = this.scene.playerActions
    this.addInput(() => [
      a.PREV_FIRE_MODE.onDown(() => {
        scene.playerWeaponManager.fireGroup.prev()
        scene.ui.weapon.notifyChanged()
      }),
      a.NEXT_FIRE_MODE.onDown(() => {
        scene.playerWeaponManager.fireGroup.next()
        scene.ui.weapon.notifyChanged()
      }),
    ])
  }
}