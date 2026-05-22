import { Input, Scenes } from 'phaser'
import { FireMode } from '../../../../config.ts'
import { getDeltaT } from '../../../../helpers/_helpers.ts'
import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import { GameEvent } from '../../../events.ts'
import type { ChargeableWeapon } from '../WeaponManagerInput.ts'
import { InputController } from '../InputController.ts'
import POINTER_DOWN = Input.Events.POINTER_DOWN
import POINTER_UP = Input.Events.POINTER_UP
import Pointer = Input.Pointer
import UPDATE = Scenes.Events.UPDATE

export class WeaponChargeInput extends InputController {
  // charge per second
  private chargeRate = 400
  private charge = 0

  public isCharging = false
  public mode: FireMode = FireMode.DESTROY

  constructor(
    public scene: GameLevel,
    public weapon: ChargeableWeapon,
  ) {
    super(scene)
    this.bind(this.scene.input, POINTER_DOWN, this.pointerdown)
    this.bind(this.scene.input, POINTER_UP, this.pointerup)
    this.bind(this.scene.events, UPDATE, this.update)
  }

  pointerdown(pointer: Pointer) {
    if (pointer.rightButtonDown()) {
      this.isCharging = true
      this.mode = FireMode.CREATE
    } else if (pointer.leftButtonDown()) {
      this.isCharging = true
      this.mode = FireMode.DESTROY
    }
  }

  pointerup(pointer: Pointer) {
    if (pointer.rightButtonReleased() || pointer.leftButtonReleased()) {
      if (this.charge > 0) {
        this.weapon.fireQueued()
      }

      this.isCharging = false
      this.charge = 0
    }
  }

  getChargePercent() {
    const max = this.getMaxCharge()
    return max === 0 ? 0 : this.charge / max
  }

  update(_time: number, delta: number) {
    if (!this.isCharging) return

    const maxCharge = this.getMaxCharge()

    if (!maxCharge) {
      if (this.mode === FireMode.DESTROY) this.scene.EVENTS.emit(GameEvent.MESSAGE, 'Matter Tank Full!')
      if (this.mode === FireMode.CREATE) this.scene.EVENTS.emit(GameEvent.MESSAGE, 'Matter Tank Empty!')
      return
    }

    const dt = getDeltaT(delta)
    this.charge = Math.min(this.charge + Math.floor(this.chargeRate * dt), maxCharge)
    this.weapon.getQueuedProjectile(this.mode).setTilesToModify(this.charge)
  }

  getMaxCharge(): number {
    return this.scene.player.matterTank.chargeAvailable(this.mode)
  }

  protected onDestroy() {
    super.onDestroy()
    // @ts-expect-error: destroy
    this.weapon = null
  }
}
