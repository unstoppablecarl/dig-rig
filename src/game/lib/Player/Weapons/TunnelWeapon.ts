import { Scenes } from 'phaser'
import { FireMode } from '../../../config.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { PlayerWeaponTorchInput } from '../../Input/PlayerWeaponTorchInput.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import { NoopProjectileRenderer } from '../../Projectiles/ProjectileRenderer.ts'
import { TunnelProjectile } from '../../Projectiles/TunnelProjectile.ts'
import type { ContinuousWeapon } from './PlayerWeaponManager.ts'
import UPDATE = Scenes.Events.UPDATE

const DESTROY_PROJECTILE_DISTANCE = 20
const DESTROY_PROJECTILE_EXPAND_RATE_MS = 10

export class TunnelWeapon extends SceneBound implements ContinuousWeapon {
  private input: PlayerWeaponTorchInput
  public displayName = 'Tunnel'

  private projectileDestroy: TunnelProjectile | null = null
  public destroyedTilesToTransfer = 0

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)
    this.input = new PlayerWeaponTorchInput(scene, this)
  }

  firing(value: boolean, _mode: FireMode): void {
    if (value) {
      if (!this.projectileDestroy || this.projectileDestroy.destroyed) {
        const availableCharge = this.scene.player.matterTank.chargeAvailable(FireMode.DESTROY)
        const charge = Math.min(TunnelProjectile.MAX_TILES_TO_MOD, availableCharge)
        this.projectileDestroy = this.scene.projectiles.fireForPlayer(TunnelProjectile, charge, FireMode.DESTROY, 0) ?? null
        if (!this.projectileDestroy) return
        this.projectileDestroy.weapon = this
      }
    } else {
      this.addCreateProjectile()
      this.projectileDestroy?.destroy()
      this.projectileDestroy = null
    }
  }

  get enabled() {
    return this.input.enabled
  }

  setEnabled(value: boolean) {
    this.input.setInputEnabled(value)

    if (value) {
      this.scene.events.on(UPDATE, this.update, this)
    } else {
      this.scene.events.off(UPDATE, this.update, this)
      this.projectileDestroy?.destroy()
      this.projectileDestroy = null
    }
  }

  private _pos: Position = { x: 0, y: 0 }

  public update() {
    if (!this.projectileDestroy) return
    const destroyPos = this.scene.player.getProjectilePosition(0, this._pos)
    this.projectileDestroy.x = destroyPos.x
    this.projectileDestroy.y = destroyPos.y

    this.addCreateProjectile()
  }

  private addCreateProjectile() {
    if (!this.projectileDestroy) return
    const destroyed = this.destroyedTilesToTransfer
    if (!destroyed) return
    const availableCharge = Math.min(destroyed, this.scene.player.matterTank.chargeAvailable(FireMode.CREATE))
    if (!availableCharge) return
    this.destroyedTilesToTransfer -= availableCharge
    const pos = this.scene.player.getInverseProjectilePosition(DESTROY_PROJECTILE_DISTANCE, this._pos)
    const projectile = this.scene.projectiles.fireForPlayer(Projectile, availableCharge, FireMode.CREATE, 0, pos, 0, new NoopProjectileRenderer())
    if (!projectile) return
    projectile.expandRateMs = DESTROY_PROJECTILE_EXPAND_RATE_MS
    projectile.startExpandTimer()
  }

  protected onDestroy() {
    this.input.destroy()
    this.projectileDestroy?.destroy()
    this.projectileDestroy = null
    this.scene.events.off(UPDATE, this.update, this)
  }
}