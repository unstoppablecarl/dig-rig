import { Scenes } from 'phaser'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import type { ChargeableWeapon } from '../../Input/InputController/WeaponManagerInput.ts'
import { WeaponChargeInput } from '../../Input/InputController/WeaponManagerInput/WeaponChargeInput.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import { FireMode } from '../_FireMode-types'
import UPDATE = Scenes.Events.UPDATE

export class BasicWeapon extends WeaponChargeInput implements ChargeableWeapon {
  private queued: Projectile | null = null

  constructor(scene: GameLevel) {
    super(scene)
    this.binder.add(scene.events, UPDATE, this.update, this)
  }

  getFireMode(): FireMode {
    return this.mode
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

  update(_time: number, delta: number) {
    super.update(_time, delta)
    if (this.queued) {
      const pos = this.scene.player.getProjectilePosition(this.queued.radius, this._pos)
      this.queued.x = pos.x
      this.queued.y = pos.y
    }
  }

  protected onDestroy() {
    super.onDestroy()
    this.queued?.destroy()
    this.queued = null
  }
}