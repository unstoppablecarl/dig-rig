import { Scenes } from 'phaser'
import { FireMode } from '../../../config.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { WeaponChargeInput } from '../../Input/InputControllers/WeaponManagerInput/WeaponChargeInput.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import type { ChargeableWeapon } from '../../Input/InputControllers/WeaponManagerInput.ts'
import UPDATE = Scenes.Events.UPDATE

export class BasicWeapon extends SceneBound implements ChargeableWeapon {
  readonly displayName = 'Basic'

  private queued: Projectile | null = null
  private chargeInput: WeaponChargeInput

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)
    this.chargeInput = new WeaponChargeInput(scene, this)
  }

  getFireMode(): FireMode {
    return this.chargeInput.mode
  }

  getChargePercent(): number {
    return this.chargeInput.getChargePercent()
  }

  get enabled() {
    return this.chargeInput.enabled
  }

  setEnabled(value: boolean) {
    this.chargeInput.setInputEnabled(value)

    if (value) {
      this.scene.events.on(UPDATE, this.update, this)
    } else {
      this.scene.events.off(UPDATE, this.update, this)
    }
  }

  private _pos: Position = { x: 0, y: 0 }

  getQueuedProjectile(mode: FireMode) {
    if (this.queued && this.queued.mode !== mode) {
      this.queued.destroy()
      this.queued = null
    }
    if (!this.queued) {
      const pos = this.scene.player.getProjectilePosition(0, this._pos)
      this.queued = this.scene.projectiles.add(Projectile, this.scene.player, this.scene.player.matterTank, pos.x, pos.y, 1, mode)
    }
    return this.queued
  }

  fireQueued() {
    if (!this.queued) {
      throw new Error('No projectile queued')
    }

    const player = this.scene.player
    this.queued.fire(player.getProjectileAngle())
    this.queued = null
  }

  public update() {
    if (this.queued) {
      const pos = this.scene.player.getProjectilePosition(this.queued.radius, this._pos)
      this.queued.x = pos.x
      this.queued.y = pos.y
    }
  }

  protected onDestroy() {
    this.chargeInput.destroy()
    this.queued?.destroy()
    this.queued = null
    this.scene.events.off(UPDATE, this.update, this)
  }
}