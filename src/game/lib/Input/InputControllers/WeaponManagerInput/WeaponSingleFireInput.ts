import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import { FireMode } from '../../../Player/_FireMode-types'
import { InputController } from '../InputController.ts'

export abstract class WeaponSingleFireInput extends InputController {

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    const a = this.scene.playerActions
    this.addInput(() => [
      a.PREV_MODE.onDown(() => {
        scene.weaponUIState.prevFireGroup()
      }),
      a.NEXT_MODE.onDown(() => {
        scene.weaponUIState.nextFireGroup()
      }),
      a.FIRE_PRIMARY.onDown(() => this.fire(this.scene.weaponUIState.fireGroupPrimary)),
      a.FIRE_SECONDARY.onDown(() => this.fire(this.scene.weaponUIState.fireGroupSecondary)),
    ])
  }

  setEnabled(value: boolean) {
    this.setInputEnabled(value)
  }

  abstract fire(mode: FireMode): void
}
