import { Scenes } from 'phaser'
import { FireMode } from '../../../../config.ts'
import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import { InputController } from '../InputController.ts'
import UPDATE = Scenes.Events.UPDATE

export abstract class WeaponConstantInput extends InputController {
  public mode: FireMode = FireMode.DESTROY
  private firing = false

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    this.addEvent(this.scene.events, UPDATE, this.update)

    const a = this.scene.playerActions
    this.addInput(() => [
      a.FIRE_PRIMARY.onDown(() => {
        this.firing = true
        this.mode = this.getPrimary()
      }),
      a.FIRE_SECONDARY.onDown(() => {
        this.firing = true
        this.mode = this.getSecondary()
      }),
      a.FIRE_PRIMARY.onUp(() => {
        this.firing = false
      }),
      a.FIRE_SECONDARY.onUp(() => {
        this.firing = false
      }),
    ])
  }

  protected getPrimary(): FireMode {
    return this.scene.playerWeaponManager.fireGroup.primary()
  }

  protected getSecondary(): FireMode {
    return this.scene.playerWeaponManager.fireGroup.secondary()
  }

  setEnabled(value: boolean) {
    this.setInputEnabled(value)
  }

  protected onDisable() {
    this.firing = false
  }

  abstract updateFiring(value: boolean, mode: FireMode): void

  update(_time: number, _delta: number) {
    this.updateFiring(this.firing, this.mode)
  }

  protected onDestroy() {
    super.onDestroy()
  }
}
