import { Scenes } from 'phaser'
import { FireMode } from '../../../config.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { PlayerWeaponConstantInput } from '../../Input/PlayerWeaponConstantInput.ts'
import { MatterTank } from '../../Matter/MatterTank.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import { TunnelProjectile } from '../../Projectiles/TunnelProjectile.ts'
import type { ContinuousWeapon } from './PlayerWeaponManager.ts'
import UPDATE = Scenes.Events.UPDATE

const DESTROY_PROJECTILE_DISTANCE = 20
const DESTROY_PROJECTILE_EXPAND_RATE_MS = 10

export class TunnelWeapon extends SceneBound implements ContinuousWeapon {
  readonly displayName = 'Tunnel'

  private input: PlayerWeaponConstantInput

  private projectileDestroy: TunnelProjectile | null = null
  readonly matterTank: MatterTank

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)
    this.input = new PlayerWeaponConstantInput(scene, this)
    this.matterTank = new MatterTank(scene.matterManager, TunnelProjectile.MAX_TILES_TO_MOD * 1000)
  }

  _startPos: Position = { x: 0, y: 0 }

  firing(value: boolean): void {
    this.projectileDestroy!.active = value
    this.addCreateProjectile()
  }

  get enabled() {
    return this.input.enabled
  }

  setEnabled(value: boolean) {
    this.input.setInputEnabled(value)

    if (value) {
      this.initDestroyProjectile()
      this.scene.events.on(UPDATE, this.update, this)
    } else {
      this.scene.events.off(UPDATE, this.update, this)
    }
  }

  private _pos: Position = { x: 0, y: 0 }

  public update() {
    if (this.projectileDestroy) {
      const destroyPos = this.scene.player.getProjectilePosition(0, this._pos)
      this.projectileDestroy.x = destroyPos.x
      this.projectileDestroy.y = destroyPos.y
    }

    this.addCreateProjectile()
  }

  private initDestroyProjectile() {
    if (this.projectileDestroy) return
    const availableCharge = this.matterTank.chargeAvailable(FireMode.DESTROY)
    const charge = Math.min(TunnelProjectile.MAX_TILES_TO_MOD, availableCharge)

    const startPos = this.scene.player.getProjectilePosition(0, this._startPos)

    this.projectileDestroy = this.scene.projectiles.add(TunnelProjectile, this.scene.player, this.matterTank, startPos.x, startPos.y, charge, FireMode.DESTROY)
  }

  private addCreateProjectile() {
    const charge = this.matterTank.chargeAvailable(FireMode.CREATE)
    if (!charge) return
    const pos = this.scene.player.getInverseProjectilePosition(DESTROY_PROJECTILE_DISTANCE, this._pos)

    const projectile = this.scene.projectiles.add(Projectile, this.scene.player, this.matterTank, pos.x, pos.y, charge, FireMode.CREATE, null)
    projectile.fire()

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