import { Scenes } from 'phaser'
import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import { FireMode } from '../../../Player/_FireMode-types'
import { InputController } from '../InputController.ts'
import UPDATE = Scenes.Events.UPDATE

export abstract class WeaponRapidFireInput extends InputController {
  protected coolDown = 0
  abstract readonly rateOfFireMs: number

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    this.addEvent(this.scene.events, UPDATE, this.update)
    const a = this.scene.playerActions
    this.addInput(() => [
      a.PREV_MODE.onDown(() => {
        scene.weaponUIState.prevFireGroup()
      }),
      a.NEXT_MODE.onDown(() => {
        scene.weaponUIState.nextFireGroup()
      }),
    ])
  }

  update(_time: number, delta: number) {
    this.coolDown -= delta

    if (this.coolDown > 0) return

    const a = this.scene.playerActions

    let mode: FireMode
    if (a.FIRE_SECONDARY.isDown()) {
      mode = this.scene.weaponUIState.fireGroupSecondary
    } else if (a.FIRE_PRIMARY.isDown()) {
      mode = this.scene.weaponUIState.fireGroupPrimary
    } else {
      this.coolDown = 0
      return
    }

    this.coolDown += this.rateOfFireMs
    this.fire(mode)
  }

  setEnabled(value: boolean) {
    this.setInputEnabled(value)
  }

  abstract fire(mode: FireMode): void

  protected onDestroy() {
    super.onDestroy()
  }
}
