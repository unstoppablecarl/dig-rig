import { FireMode } from '../../config.ts'
import { getDeltaT } from '../../helpers/_helpers.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { EVENT_MESSAGE } from '../events.ts'
import type { ChargeableWeapon } from '../Player/Weapons/PlayerWeaponManager.ts'
import type { InputController } from './InputManager.ts'
import POINTER_DOWN = Phaser.Input.Events.POINTER_DOWN
import POINTER_UP = Phaser.Input.Events.POINTER_UP
import Pointer = Phaser.Input.Pointer
import UPDATE = Phaser.Scenes.Events.UPDATE

export class PlayerWeaponChargeInput extends SceneBound<GameLevel> implements InputController {
  // charge per second
  private chargeRate = 400
  private charge = 0

  public isCharging = false
  public mode: FireMode = FireMode.DESTROY

  private _enabled = false

  constructor(
    public scene: GameLevel,
    public weapon: ChargeableWeapon,
  ) {
    super(scene)
  }

  get enabled() {
    return this._enabled
  }

  setInputEnabled(value: boolean) {
    if (this._enabled === value) return

    if (value) {
      this.scene.input.on(POINTER_DOWN, this.pointerdown, this)
      this.scene.input.on(POINTER_UP, this.pointerup, this)
      this.scene.events.on(UPDATE, this.update, this)
    } else {
      this.scene.input.off(POINTER_DOWN, this.pointerdown, this)
      this.scene.input.off(POINTER_UP, this.pointerup, this)
      this.scene.events.off(UPDATE, this.update, this)
    }

    this._enabled = value
  }

  pointerdown(pointer: Pointer) {
    if (pointer.rightButtonDown()) {
      this.isCharging = true
      this.mode = FireMode.CREATE
    }

    if (pointer.leftButtonDown()) {
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
    if (this.getMaxCharge() === 0) {
      return 0
    }
    return this.charge / this.getMaxCharge()
  }

  update(_time: number, delta: number) {
    const dt = getDeltaT(delta)

    if (!this._enabled) return

    if (this.isCharging) {
      if (!this.getMaxCharge()) {
        if (this.mode === FireMode.DESTROY) {
          console.log('no destroy capacity')
          this.scene.EVENTS.emit(EVENT_MESSAGE, 'Matter Tank Full!')
        }

        if (this.mode === FireMode.CREATE) {
          console.log('no create capacity')
          this.scene.EVENTS.emit(EVENT_MESSAGE, 'Matter Tank Empty!')
        }

        return
      }
      this.charge += Math.floor(this.chargeRate * dt)

      const maxCharge = this.getMaxCharge()
      this.charge = Math.min(this.charge, maxCharge)

      if (this.charge === maxCharge) {
        console.log('Max charge reached.', maxCharge)
      }

      this.weapon
        .getQueuedProjectile(this.mode)
        .setTilesToModify(this.charge)
    }
  }

  getMaxCharge(): number {
    return this.scene.player.matterTank.chargeAvailable(this.mode)
  }
}