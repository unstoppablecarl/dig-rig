import { Scenes } from 'phaser'
import { FireMode } from '../../../../config.ts'
import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import { InputController } from '../InputController.ts'
import type { Weapon } from '../WeaponManagerInput.ts'
import UPDATE = Scenes.Events.UPDATE

export interface ContinuousWeapon extends Weapon {
  firing(value: boolean, mode: FireMode): void,
}

export class WeaponConstantInput extends InputController {
  public mode: FireMode = FireMode.DESTROY
  private firing = false

  constructor(
    public scene: GameLevel,
    public weapon: ContinuousWeapon,
  ) {
    super(scene)
    this.addEvent(this.scene.events, UPDATE, this.update)

    const a = this.scene.playerActions
    this.addInput(() => [
      a.FIRE_PRIMARY.onDown(() => {
        this.firing = true
        this.mode = FireMode.DESTROY
      }),
      a.FIRE_SECONDARY.onDown(() => {
        this.firing = true
        this.mode = FireMode.CREATE
      }),
      a.FIRE_PRIMARY.onUp(() => {
        this.firing = false
      }),
      a.FIRE_SECONDARY.onUp(() => {
        this.firing = false
      }),
    ])
  }

  protected onDisable() {
    this.firing = false
  }

  update(_time: number, _delta: number) {
    this.weapon.firing(this.firing, this.mode)
  }

  protected onDestroy() {
    super.onDestroy()
    // @ts-expect-error: destroy
    this.weapon = null
  }
}
