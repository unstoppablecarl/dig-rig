import type { FireMode } from '../../../../config.ts'
import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import { InputController } from '../InputController.ts'

export abstract class WeaponSingleFireInput extends InputController {

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    const a = this.scene.playerActions
    this.addInput(() => [
      a.FIRE_PRIMARY.onDown(() => this.fire(this.scene.playerWeaponManager.fireGroup.primary())),
      a.FIRE_SECONDARY.onDown(() => this.fire(this.scene.playerWeaponManager.fireGroup.secondary())),
    ])
  }

  setEnabled(value: boolean) {
    this.setInputEnabled(value)
  }

  abstract fire(mode: FireMode): void
}
