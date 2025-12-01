import { FireMode } from '../../../config.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { PlayerWeaponChargeInput } from '../../Input/PlayerWeaponChargeInput.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import { TerrainType } from '../../TileMap/TileMap.ts'
import type { ChargeableWeapon } from './PlayerWeaponManager.ts'
import UPDATE = Phaser.Scenes.Events.UPDATE

export class BasicWeapon extends SceneBound implements ChargeableWeapon {
  private queued: Projectile | null
  private chargeInput: PlayerWeaponChargeInput
  public displayName = 'Basic'

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)
    this.chargeInput = new PlayerWeaponChargeInput(scene, this)
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

  getQueuedProjectile(mode: FireMode) {
    if (this.queued && this.queued.mode !== mode) {
      this.queued.destroy()
      this.queued = null
    }
    if (!this.queued) {
      const pos = this.scene.player.getProjectilePosition()
      this.queued = this.scene.projectiles.add(pos.x, pos.y, this.scene.player, this.scene.player.matterTank, 1, mode)
    }
    return this.queued
  }

  fireQueued() {
    if (!this.queued) {
      throw new Error('No projectile queued')
    }

    const player = this.scene.player
    const tilemap = this.scene.tilemap

    const debugUnstuck = false

    if (debugUnstuck) {
      const { x, y } = tilemap.getTilePosFromWorld(player.x, player.y)
      tilemap.applyEffect(x, y, 18, TerrainType.EMPTY, Number.MAX_VALUE)
    }
    this.queued.fire(player.getProjectileAngle())
    this.queued = null
  }

  public update() {
    if (this.queued) {
      const pos = this.scene.player.getProjectilePosition(this.queued.radius)
      this.queued.x = pos.x
      this.queued.y = pos.y
    }
  }
}