import { FireMode } from '../../../config.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import type { Weapon } from '../../Input/InputControllers/WeaponManagerInput.ts'
import { WeaponConstantInput } from '../../Input/InputControllers/WeaponManagerInput/WeaponConstantInput.ts'
import { MatterTank } from '../../Matter/MatterTank.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import { TunnelDestroyProjectile } from '../../Projectiles/TunnelDestroyProjectile.ts'

const DESTROY_PROJECTILE_DISTANCE = 20
const DESTROY_PROJECTILE_EXPAND_RATE_MS = 10
const DESTROY_PROJECTILE_VELOCITY = 1000

export class TunnelWeapon extends WeaponConstantInput implements Weapon {
  readonly displayName = 'Tunnel'

  private projectileDestroy: TunnelDestroyProjectile | null = null
  readonly matterTank: MatterTank

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)
    this.matterTank = new MatterTank(scene.matterManager, TunnelDestroyProjectile.MAX_TILES_TO_MOD)
  }

  private _startPos: Position = { x: 0, y: 0 }

  updateFiring(value: boolean): void {
    if (this.projectileDestroy) {
      this.projectileDestroy.active = value
      const destroyPos = this.scene.player.getProjectilePosition(0, this._pos)
      this.projectileDestroy.x = destroyPos.x
      this.projectileDestroy.y = destroyPos.y
    }

    this.addCreateProjectile()
  }

  protected onEnable() {
    this.initDestroyProjectile()
    this.scene.ui.matterMeter.setMatterTank(this.matterTank)
  }

  protected onDisable() {
    super.onDisable()
    this.scene.ui.matterMeter.setMatterTank(this.scene.player.matterTank)
  }

  private _pos: Position = { x: 0, y: 0 }

  private initDestroyProjectile() {
    if (this.projectileDestroy) return
    const availableCharge = this.matterTank.chargeAvailable(FireMode.DESTROY)
    const charge = Math.min(TunnelDestroyProjectile.MAX_TILES_TO_MOD, availableCharge)

    const startPos = this.scene.player.getProjectilePosition(0, this._startPos)

    this.projectileDestroy = this.scene.projectiles.add(TunnelDestroyProjectile, this.scene.player, this.matterTank, startPos.x, startPos.y, charge, FireMode.DESTROY)
  }

  private addCreateProjectile() {
    const charge = this.matterTank.chargeAvailable(FireMode.CREATE)
    if (!charge) return
    const pos = this.scene.player.getInverseProjectilePosition(DESTROY_PROJECTILE_DISTANCE, this._pos)

    const projectile = this.scene.projectiles.add(Projectile, this.scene.player, this.matterTank, pos.x, pos.y, charge, FireMode.CREATE, null)
    const angle = this.scene.player.getProjectileAngle()
    const vx = Math.cos(angle) * -1
    const vy = Math.sin(angle) * -1
    projectile.fireRaw(vx, vy, DESTROY_PROJECTILE_VELOCITY)
    projectile.expandRateMs = DESTROY_PROJECTILE_EXPAND_RATE_MS
  }

  protected onDestroy() {
    super.onDestroy()
    this.projectileDestroy?.destroy()
    this.projectileDestroy = null
  }
}