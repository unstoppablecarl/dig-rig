import { getDeltaT, isMatterTankFireMode } from '../../../../helpers/_helpers.ts'
import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import { GameEvent } from '../../../events.ts'
import { FireMode } from '../../../Player/_FireMode-types'
import type { Projectile } from '../../../Projectiles/Projectile.ts'
import { InputController } from '../InputController.ts'

export abstract class WeaponChargeInput extends InputController {
  // charge per second
  private chargeRate = 400
  private charge = 0

  public isCharging = false
  public mode: FireMode = FireMode.DESTROY

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    const stopCharging = () => {
      if (!this.isCharging) return
      if (this.charge > 0) this.fireQueued()
      this.isCharging = false
      this.charge = 0
    }

    const a = this.scene.playerActions

    this.addInput(() => [
      a.PREV_MODE.onDown(() => {
        scene.weaponUIState.prevFireGroup()
      }),
      a.NEXT_MODE.onDown(() => {
        scene.weaponUIState.nextFireGroup()
      }),
      a.FIRE_PRIMARY.onDown(() => {
        this.isCharging = true
        this.mode = FireMode.DESTROY
      }),
      a.FIRE_SECONDARY.onDown(() => {
        this.isCharging = true
        this.mode = FireMode.CREATE
      }),
      a.FIRE_PRIMARY.onUp(stopCharging),
      a.FIRE_SECONDARY.onUp(stopCharging),
    ])
  }

  protected onDisable() {
    this.isCharging = false
    this.charge = 0
  }

  protected getCharge(): number {
    return this.charge
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
    this.getQueuedProjectile(this.mode).setTilesToModify(this.charge)
    this.scene.weaponUIState.charge = this.charge
  }

  getMaxCharge(): number {
    if (isMatterTankFireMode(this.mode)) {
      return this.scene.player.matterTank.chargeAvailable(this.mode)
    }
    return Infinity
  }

  setEnabled(value: boolean) {
    this.setInputEnabled(value)
  }

  abstract getQueuedProjectile(mode: FireMode): Projectile

  abstract fireQueued(): void

  abstract getFireMode(): FireMode

  protected onDestroy() {
    super.onDestroy()
  }
}
