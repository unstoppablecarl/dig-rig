import { Scenes } from 'phaser'
import { FireMode } from '../../../../config.ts'
import type { GameLevel } from '../../../../scenes/GameLevel.ts'
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
  }

  update(_time: number, delta: number) {
    this.coolDown -= delta

    if (this.coolDown > 0) return

    const a = this.scene.playerActions
    const fireGroup = this.scene.playerWeaponManager.fireGroup

    let mode: FireMode
    if (a.FIRE_SECONDARY.isDown()) {
      mode = fireGroup.secondary()
    } else if (a.FIRE_PRIMARY.isDown()) {
      mode = fireGroup.primary()
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
